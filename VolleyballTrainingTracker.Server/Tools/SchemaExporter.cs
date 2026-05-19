using System.Text;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Data;

namespace VolleyballTrainingTracker.Server.Tools;

/// <summary>
/// Reads INFORMATION_SCHEMA + sys.identity_columns and emits TypeScript files
/// to the client's Schema folder, so the frontend can import strongly-typed
/// table definitions without manually duplicating SQL columns.
/// </summary>
public class SchemaExporter
{
    private readonly AppDbContext _db;
    private readonly string _outputDir;

    public SchemaExporter(AppDbContext db, string outputDir)
    {
        _db = db;
        _outputDir = outputDir;
    }

    public async Task RunAsync()
    {
        var rootDir = Path.GetFullPath(_outputDir);
        var tableDir = Path.Combine(rootDir, "TableSchema");
        var seqDir = Path.Combine(rootDir, "Sequences");
        Directory.CreateDirectory(tableDir);
        Directory.CreateDirectory(seqDir);

        Console.WriteLine($"[SchemaExporter] Output root: {rootDir}");

        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync();

        var tables = await LoadTablesAsync(conn);
        Console.WriteLine($"[SchemaExporter] Found {tables.Count} table(s)");

        var indexLines = new List<string>();
        var seqIndexLines = new List<string>();

        foreach (var t in tables.OrderBy(x => x.Name))
        {
            var path = Path.Combine(tableDir, $"{t.Name}.ts");
            await File.WriteAllTextAsync(path, BuildTableTs(t), new UTF8Encoding(false));
            indexLines.Add($"export * from './{t.Name}';");
            Console.WriteLine($"  - {t.Name}.ts ({t.Columns.Count} cols)");

            var identityCols = t.Columns.Where(c => c.IsIdentity).ToList();
            if (identityCols.Count > 0)
            {
                var seqPath = Path.Combine(seqDir, $"{t.Name}.ts");
                await File.WriteAllTextAsync(seqPath, BuildSequenceTs(t, identityCols), new UTF8Encoding(false));
                seqIndexLines.Add($"export * from './{t.Name}';");
            }
        }

        await File.WriteAllTextAsync(Path.Combine(tableDir, "index.ts"),
            string.Join("\n", indexLines) + "\n", new UTF8Encoding(false));
        await File.WriteAllTextAsync(Path.Combine(seqDir, "index.ts"),
            string.Join("\n", seqIndexLines) + "\n", new UTF8Encoding(false));

        await File.WriteAllTextAsync(Path.Combine(rootDir, "README.md"), BuildReadme(tables), new UTF8Encoding(false));
        Console.WriteLine($"[SchemaExporter] Done. Wrote {tables.Count} table file(s).");
    }

    // ---------------- SQL loaders ----------------

    private static async Task<List<TableInfo>> LoadTablesAsync(System.Data.Common.DbConnection conn)
    {
        // PostgreSQL: information_schema 查詢
        const string colSql = @"
SELECT
    c.table_schema, c.table_name, c.column_name, c.ordinal_position,
    c.is_nullable, c.data_type,
    c.character_maximum_length, c.numeric_precision, c.numeric_scale,
    c.column_default,
    c.is_identity
FROM information_schema.columns c
INNER JOIN information_schema.tables t
    ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_type = 'BASE TABLE'
  AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.table_name <> '__EFMigrationsHistory'
ORDER BY c.table_name, c.ordinal_position;";

        const string pkSql = @"
SELECT tc.table_schema, tc.table_name, kcu.column_name, kcu.ordinal_position
FROM information_schema.table_constraints tc
INNER JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.table_name, kcu.ordinal_position;";

        const string fkSql = @"
SELECT
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS ref_schema,
    ccu.table_name   AS ref_table,
    ccu.column_name  AS ref_column
FROM information_schema.table_constraints tc
INNER JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
INNER JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.table_name, tc.constraint_name;";

        var dict = new Dictionary<string, TableInfo>(StringComparer.OrdinalIgnoreCase);

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = colSql;
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var name = r.GetString(1);
                if (!dict.TryGetValue(name, out var info))
                {
                    info = new TableInfo { Schema = r.GetString(0), Name = name };
                    dict[name] = info;
                }
                info.Columns.Add(new ColumnInfo
                {
                    Name = r.GetString(2),
                    OrdinalPosition = r.GetInt32(3),
                    IsNullable = string.Equals(r.GetString(4), "YES", StringComparison.OrdinalIgnoreCase),
                    DataType = r.GetString(5),
                    MaxLength = r.IsDBNull(6) ? null : Convert.ToInt32(r.GetValue(6)),
                    NumericPrecision = r.IsDBNull(7) ? null : Convert.ToInt32(r.GetValue(7)),
                    NumericScale = r.IsDBNull(8) ? null : Convert.ToInt32(r.GetValue(8)),
                    DefaultValue = r.IsDBNull(9) ? null : r.GetString(9),
                    IsIdentity = !r.IsDBNull(10) && string.Equals(r.GetString(10), "YES", StringComparison.OrdinalIgnoreCase),
                });
            }
        }

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = pkSql;
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var tableName = r.GetString(1);
                if (dict.TryGetValue(tableName, out var info))
                    info.PrimaryKey.Add(r.GetString(2));
            }
        }

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = fkSql;
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var tableName = r.GetString(2);
                if (dict.TryGetValue(tableName, out var info))
                {
                    info.ForeignKeys.Add(new ForeignKeyInfo
                    {
                        ConstraintName = r.GetString(0),
                        Column = r.GetString(3),
                        RefTable = r.GetString(5),
                        RefColumn = r.GetString(6),
                    });
                }
            }
        }

        return dict.Values.ToList();
    }

    // ---------------- TS emit ----------------

    private static string BuildTableTs(TableInfo t)
    {
        var sb = new StringBuilder();
        sb.AppendLine("// AUTO-GENERATED by SchemaExporter. DO NOT EDIT.");
        sb.AppendLine($"// Table: [{t.Schema}].[{t.Name}]");
        sb.AppendLine();

        sb.AppendLine($"export interface {t.Name} {{");
        foreach (var c in t.Columns.OrderBy(x => x.OrdinalPosition))
        {
            var tsType = MapToTsType(c.DataType);
            var optional = c.IsNullable ? " | null" : "";
            sb.AppendLine($"  {c.Name}: {tsType}{optional};");
        }
        sb.AppendLine("}");
        sb.AppendLine();

        sb.AppendLine($"export const {t.Name}_META = {{");
        sb.AppendLine($"  schema: '{t.Schema}',");
        sb.AppendLine($"  name: '{t.Name}',");
        sb.AppendLine($"  primaryKey: [{string.Join(", ", t.PrimaryKey.Select(p => $"'{p}'"))}] as const,");
        sb.AppendLine("  columns: [");
        foreach (var c in t.Columns.OrderBy(x => x.OrdinalPosition))
        {
            sb.Append("    { ");
            sb.Append($"name: '{c.Name}', ");
            sb.Append($"dataType: '{c.DataType}', ");
            sb.Append($"tsType: '{MapToTsType(c.DataType)}', ");
            sb.Append($"isNullable: {c.IsNullable.ToString().ToLowerInvariant()}, ");
            sb.Append($"isIdentity: {c.IsIdentity.ToString().ToLowerInvariant()}, ");
            sb.Append($"maxLength: {(c.MaxLength?.ToString() ?? "null")}, ");
            sb.Append($"precision: {(c.NumericPrecision?.ToString() ?? "null")}, ");
            sb.Append($"scale: {(c.NumericScale?.ToString() ?? "null")}, ");
            sb.Append($"default: {(c.DefaultValue == null ? "null" : "'" + c.DefaultValue.Replace("'", "\\'") + "'")}");
            sb.AppendLine(" },");
        }
        sb.AppendLine("  ],");
        sb.AppendLine("  foreignKeys: [");
        foreach (var fk in t.ForeignKeys)
        {
            sb.AppendLine($"    {{ name: '{fk.ConstraintName}', column: '{fk.Column}', refTable: '{fk.RefTable}', refColumn: '{fk.RefColumn}' }},");
        }
        sb.AppendLine("  ],");
        sb.AppendLine("} as const;");
        sb.AppendLine();

        return sb.ToString();
    }

    private static string BuildSequenceTs(TableInfo t, List<ColumnInfo> identityCols)
    {
        var sb = new StringBuilder();
        sb.AppendLine("// AUTO-GENERATED by SchemaExporter. DO NOT EDIT.");
        sb.AppendLine($"// IDENTITY columns for [{t.Schema}].[{t.Name}]");
        sb.AppendLine();
        sb.AppendLine($"export const {t.Name}_IDENTITY = {{");
        sb.AppendLine($"  table: '{t.Name}',");
        sb.AppendLine("  columns: [");
        foreach (var c in identityCols)
            sb.AppendLine($"    {{ name: '{c.Name}', dataType: '{c.DataType}' }},");
        sb.AppendLine("  ],");
        sb.AppendLine("} as const;");
        sb.AppendLine();
        return sb.ToString();
    }

    private static string BuildReadme(List<TableInfo> tables)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Schema (auto-generated)");
        sb.AppendLine();
        sb.AppendLine("This folder is produced by `dotnet run --project ../VolleyballTrainingTracker.Server -- export-schema`.");
        sb.AppendLine();
        sb.AppendLine("**Do not edit by hand** — re-run the exporter after applying SQL changes.");
        sb.AppendLine();
        sb.AppendLine("## Tables");
        foreach (var t in tables.OrderBy(x => x.Name))
            sb.AppendLine($"- `{t.Name}` ({t.Columns.Count} cols, PK: {string.Join(", ", t.PrimaryKey)})");
        return sb.ToString();
    }

    private static string MapToTsType(string sqlType) => sqlType.ToLowerInvariant() switch
    {
        // PostgreSQL information_schema.data_type 值
        "integer" or "smallint" or "bigint" => "number",
        "numeric" or "decimal" or "real" or "double precision" or "money" => "number",
        "boolean" => "boolean",
        "date" => "string",
        "timestamp without time zone" or "timestamp with time zone" => "string",
        "time without time zone" or "time with time zone" => "string",
        "interval" => "string",
        "character varying" or "character" or "text" or "citext" => "string",
        "uuid" => "string",
        "json" or "jsonb" or "xml" => "string",
        "bytea" => "string",
        _ => "unknown",
    };

    // ---------------- DTOs ----------------

    private sealed class TableInfo
    {
        public string Schema { get; set; } = "dbo";
        public string Name { get; set; } = "";
        public List<ColumnInfo> Columns { get; } = new();
        public List<string> PrimaryKey { get; } = new();
        public List<ForeignKeyInfo> ForeignKeys { get; } = new();
    }

    private sealed class ColumnInfo
    {
        public string Name { get; set; } = "";
        public int OrdinalPosition { get; set; }
        public bool IsNullable { get; set; }
        public string DataType { get; set; } = "";
        public int? MaxLength { get; set; }
        public int? NumericPrecision { get; set; }
        public int? NumericScale { get; set; }
        public string? DefaultValue { get; set; }
        public bool IsIdentity { get; set; }
    }

    private sealed class ForeignKeyInfo
    {
        public string ConstraintName { get; set; } = "";
        public string Column { get; set; } = "";
        public string RefTable { get; set; } = "";
        public string RefColumn { get; set; } = "";
    }
}
