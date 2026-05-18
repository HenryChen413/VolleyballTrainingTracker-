# SQL Scripts (DB-First)

依序套用至 MSSQL：

```bash
sqlcmd -S localhost -U sa -P <YourPwd> -i 001_init_auth.sql
sqlcmd -S localhost -U sa -P <YourPwd> -i 002_core_tables.sql
sqlcmd -S localhost -U sa -P <YourPwd> -i 003_seed.sql
```

或在 SSMS / Azure Data Studio 直接執行。

套用完後跑 SchemaExporter 將欄位資訊匯出到 Client：

```bash
dotnet run --project ../VolleyballTrainingTracker.Server -- export-schema
```

> 預設 Coach 帳號：`coach` / `Coach@123`（請於首次登入後改密碼）。
