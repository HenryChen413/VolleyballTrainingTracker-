# Volleyball Training Tracker

ASP.NET Core 8 + React 19 (Vite + TS) + PostgreSQL 15 排球訓練紀錄系統。

## 本機開發

### 1. 啟動 MSSQL（Docker）
```bash
docker compose up -d mssql
```

### 2. 套用 Schema
```powershell
$pwd = 'Your_password123'
sqlcmd -S localhost -U sa -P $pwd -i VolleyballTrainingTracker.Server/Data/Sql/001_init_auth.sql
sqlcmd -S localhost -U sa -P $pwd -i VolleyballTrainingTracker.Server/Data/Sql/002_core_tables.sql
sqlcmd -S localhost -U sa -P $pwd -i VolleyballTrainingTracker.Server/Data/Sql/003_seed.sql
```

或讓 compose 一次跑起來：
```bash
docker compose up db-init
```

### 3. 匯出 Schema 到 Client
```bash
dotnet run --project VolleyballTrainingTracker.Server -- export-schema
```
→ 寫入 `volleyballtrainingtracker.client/Schema/TableSchema/*.ts` 與 `Sequences/*.ts`

### 4. 啟動後端 + 前端
從 Visual Studio 開啟 `VolleyballTrainingTracker.sln` 並按 F5；或：
```bash
# server
dotnet run --project VolleyballTrainingTracker.Server
# client (另一個視窗)
cd volleyballtrainingtracker.client
npm run dev
```

預設 Coach 帳號：`coach` / `Coach@123`（請於首次登入後改密碼）

## 完整 Docker 部署
```bash
cp .env.example .env   # 填入強隨機密碼與 JWT 金鑰
docker compose up -d
```
- `postgres` 首次啟動會自動套用 `pg_init.sql` 建立 schema
- `db-seed` 會建立系統角色並以 `.env` 的 `ADMIN_PASSWORD` 建立超級管理員 `YUANHE`
- 服務在 `http://localhost:8080`（含前端 + API）

### 安全部署須知（對外發佈）
- **機密一律由 `.env` / 環境變數注入**，切勿寫死於 `appsettings.json`：
  - `Jwt__SecretKey` —— 至少 32 字元隨機字串（`openssl rand -base64 48`）。
    非開發環境若未設定或仍是預設值，程式會拒絕啟動。
  - `ConnectionStrings__Default` —— 資料庫連線字串，請用最小權限帳號。
- 對外請在前方架反向代理（Nginx/Caddy）終止 TLS，並轉發 `X-Forwarded-Proto`。
- 將 `Cors__AllowedOrigins__0` 設為正式網域；登入端點已內建速率限制。

## 專案結構
```
VolleyballTrainingTracker.Server/   # ASP.NET Core 8 Web API
  Auth/                JWT 服務
  Controllers/         AuthController, PlayersController, SessionsController, DrillsController, StatsController
  Data/
    AppDbContext.cs    EF Core
    Sql/               ★ 純 SQL 腳本（DB-First 來源）
  Dtos/                Request/Response
  Entities/            EF 實體
  Tools/SchemaExporter.cs   ★ DB → Client/Schema 匯出工具
  Dockerfile           Windows nanoserver (Visual Studio default)
  Dockerfile.linux     Linux 多階段 (docker compose 使用)

volleyballtrainingtracker.client/   # React 19 + Vite + TS
  src/
    api/               axios + endpoints
    auth/              ProtectedRoute
    components/ui/     shadcn 元件 (button, input, card, ...)
    components/        AppLayout, DrillRecordsEditor
    pages/             Login, Register, Dashboard, Players, PlayerEdit, Sessions, SessionEdit, Stats
    stores/authStore.ts
  Schema/              ★ 由 SchemaExporter 產生（勿手改）
    TableSchema/       <TableName>.ts (interface + meta)
    Sequences/         IDENTITY 欄位
```

## Milestone 對應
- **M1** Identity + JWT + 登入註冊
- **M2** SchemaExporter（CLI）
- **M3** Players / TrainingSessions CRUD
- **M4** 動作量化紀錄
- **M5** 統計圖表（recharts）
- **M6** Docker compose
