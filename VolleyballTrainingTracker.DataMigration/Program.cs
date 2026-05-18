// =============================================================================
// VolleyballTrainingTracker.DataMigration
// 一次性資料搬移：MSSQL  ->  PostgreSQL
//
// 前提：
//   1. PostgreSQL 端已先用 ../VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql
//      建好所有資料表（結構）。
//   2. 本工具只搬「資料」，並保留原本的主鍵 Id。
//
// 執行：
//   dotnet run --project VolleyballTrainingTracker.DataMigration
//   dotnet run --project VolleyballTrainingTracker.DataMigration -- "<MSSQL連線字串>" "<PG連線字串>"
//
// 流程：
//   - 用 session_replication_role=replica 暫時關閉 PG 的 FK / trigger 檢查
//   - TRUNCATE 所有目標表（可重複執行）
//   - 逐表 SELECT * 來源 -> 參數化 INSERT 目標
//   - 還原 session_replication_role，並 setval 推進每個 identity 序列
// =============================================================================

using Microsoft.Data.SqlClient;
using Npgsql;

string mssqlConn = args.Length > 0
    ? args[0]
    : "Server=.;Database=VolleyballTrainingTracker;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False";

string pgConn = args.Length > 1
    ? args[1]
    : "Host=localhost;Port=5432;Database=VOLLEYBALLTRAININGTRACKER;Username=postgres;Password=a123";

// 搬移順序（父表在前）；identityCol = null 代表該表無 identity 欄位。
var tables = new (string Name, string? IdentityCol)[]
{
    ("Roles",             "Id"),
    ("Users",             "Id"),
    ("Players",           "Id"),
    ("Drills",            "Id"),
    ("TrainingSessions",  "Id"),
    ("SessionDrills",     null),
    ("MatchEvents",       "Id"),
    ("MatchEventPlayers", null),
    ("MatchLogs",         "Id"),
    ("AuditDeletes",      "Id"),
};

Console.WriteLine("=== VolleyballTrainingTracker 資料搬移 MSSQL -> PostgreSQL ===");
Console.WriteLine($"來源 (MSSQL): {Mask(mssqlConn)}");
Console.WriteLine($"目標 (PG)   : {Mask(pgConn)}");
Console.WriteLine();

await using var src = new SqlConnection(mssqlConn);
await using var dst = new NpgsqlConnection(pgConn);
await src.OpenAsync();
await dst.OpenAsync();

// 暫時關閉 FK / trigger 檢查（避免 Users 自我參照、跨表順序問題）
await ExecPg(dst, "SET session_replication_role = replica;");

// 先清空所有目標表（順序顛倒，CASCADE 保險）；可重複執行
var truncateList = string.Join(", ", tables.Reverse().Select(t => $"\"{t.Name}\""));
await ExecPg(dst, $"TRUNCATE {truncateList} RESTART IDENTITY CASCADE;");
Console.WriteLine("已清空目標資料表。\n");

int grandTotal = 0;
foreach (var (table, identityCol) in tables)
{
    int rows = await CopyTableAsync(src, dst, table);
    grandTotal += rows;
    Console.WriteLine($"  {table,-20} {rows,6} 列");

    // 推進 identity 序列到目前最大值
    if (identityCol != null && rows > 0)
    {
        var seqSql =
            $"SELECT setval(pg_get_serial_sequence('\"{table}\"', '{identityCol}'), " +
            $"(SELECT MAX(\"{identityCol}\") FROM \"{table}\"));";
        await ExecPg(dst, seqSql);
    }
}

// 還原 FK / trigger 檢查
await ExecPg(dst, "SET session_replication_role = origin;");

Console.WriteLine();
Console.WriteLine($"完成。共搬移 {grandTotal} 列。");
Console.WriteLine("提示：序列已校正，新增資料不會主鍵衝突。");
return;


// ---------------------------------------------------------------------------
// 逐表搬移：只複製「來源與目標都存在」的欄位
// （MSSQL 端可能殘留 EF 已忽略的死欄位，例如 MatchLogs.MatchType，需自動跳過）
// ---------------------------------------------------------------------------
static async Task<int> CopyTableAsync(SqlConnection src, NpgsqlConnection dst, string table)
{
    // 1. 目標 (PG) 實際擁有的欄位
    var targetCols = await GetPgColumnsAsync(dst, table);

    await using var readCmd = src.CreateCommand();
    readCmd.CommandText = $"SELECT * FROM [dbo].[{table}]";
    await using var reader = await readCmd.ExecuteReaderAsync();

    // 2. 來源欄位中，挑出目標也有的；記下其 reader ordinal
    var mapped = new List<(int Ordinal, string Name)>();
    var skipped = new List<string>();
    for (int i = 0; i < reader.FieldCount; i++)
    {
        var name = reader.GetName(i);
        if (targetCols.Contains(name))
            mapped.Add((i, name));
        else
            skipped.Add(name);
    }
    if (skipped.Count > 0)
        Console.WriteLine($"    （{table} 略過來源多出的欄位：{string.Join(", ", skipped)}）");

    var colList = string.Join(", ", mapped.Select(m => $"\"{m.Name}\""));
    var paramList = string.Join(", ", Enumerable.Range(0, mapped.Count).Select(i => $"@p{i}"));
    var insertSql = $"INSERT INTO \"{table}\" ({colList}) VALUES ({paramList})";

    int count = 0;
    while (await reader.ReadAsync())
    {
        await using var insert = dst.CreateCommand();
        insert.CommandText = insertSql;
        for (int i = 0; i < mapped.Count; i++)
        {
            var p = insert.CreateParameter();
            p.ParameterName = $"p{i}";
            p.Value = ConvertValue(reader.GetValue(mapped[i].Ordinal));
            insert.Parameters.Add(p);
        }
        await insert.ExecuteNonQueryAsync();
        count++;
    }
    return count;
}

// 取得 PG 某資料表目前的欄位名稱集合
static async Task<HashSet<string>> GetPgColumnsAsync(NpgsqlConnection conn, string table)
{
    var cols = new HashSet<string>(StringComparer.Ordinal);
    await using var cmd = conn.CreateCommand();
    cmd.CommandText =
        "SELECT column_name FROM information_schema.columns WHERE table_name = @t;";
    var p = cmd.CreateParameter();
    p.ParameterName = "t";
    p.Value = table;
    cmd.Parameters.Add(p);
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
        cols.Add(r.GetString(0));
    return cols;
}

// MSSQL -> PG 的值轉換
static object ConvertValue(object v) => v switch
{
    DBNull               => DBNull.Value,
    // app 一律以 UTC 寫入；timestamptz 欄位要求 Kind=Utc，date 欄位會忽略 Kind
    DateTime dt          => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
    // MSSQL tinyint -> byte；PG smallint 需要 short
    byte b               => (short)b,
    _                    => v,
};

static async Task ExecPg(NpgsqlConnection conn, string sql)
{
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = sql;
    await cmd.ExecuteNonQueryAsync();
}

// 在輸出中遮蔽密碼
static string Mask(string conn) =>
    System.Text.RegularExpressions.Regex.Replace(
        conn, @"(?i)(password|pwd)\s*=\s*[^;]*", "$1=***");
