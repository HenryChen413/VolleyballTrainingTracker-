# 高醫醫學女排‧排球訓練紀錄

ASP.NET Core 8 + React 19（Vite + TS）+ PostgreSQL 15 的排球訓練紀錄系統。

> 版權所有 — 本系統著作權屬陳源和所有，未經授權請勿使用。

## 技術棧

| 層 | 內容 |
|----|------|
| 前端 | React 19、Vite、TypeScript、Tailwind CSS、shadcn/ui、zustand、recharts、axios |
| 後端 | ASP.NET Core 8 Web API、EF Core 8、JWT 驗證 |
| 資料庫 | PostgreSQL 15（`Npgsql.EntityFrameworkCore.PostgreSQL`） |
| 部署 | 前端 Vercel ＋ 後端 Render ＋ 資料庫 Supabase（見 [DEPLOY.md](DEPLOY.md)） |

## 本機開發

### 1. 啟動 PostgreSQL（Docker）
```bash
docker compose up -d postgres
```
首次啟動會自動套用 `VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql` 建立 schema。

### 2. 建立系統角色與超級管理員
```bash
dotnet run --project VolleyballTrainingTracker.Server -- seed-roles
dotnet run --project VolleyballTrainingTracker.Server -- seed-user YUANHE "你的管理員密碼" Admin
```

### 3. 匯出 Schema 到 Client（DB-First）
```bash
dotnet run --project VolleyballTrainingTracker.Server -- export-schema
```
→ 寫入 `volleyballtrainingtracker.client/Schema/TableSchema/*.ts` 與 `Sequences/*.ts`。

### 4. 啟動後端 + 前端
從 Visual Studio 開啟 `VolleyballTrainingTracker.sln` 並按 F5；或：
```bash
# 後端
dotnet run --project VolleyballTrainingTracker.Server
# 前端（另一個視窗）
cd volleyballtrainingtracker.client
npm install
npm run dev
```
本機開發不需任何環境變數：連線字串與 JWT 金鑰已在 `appsettings.Development.json`，
前端 `VITE_API_URL` 留空時自動走 Vite dev proxy。

## 部署

完整雲端部署步驟（Vercel ＋ Render ＋ Supabase）請見 **[DEPLOY.md](DEPLOY.md)**。

### 安全部署須知（對外發佈）
- **機密一律由環境變數注入**，切勿寫死於 `appsettings.json`：
  - `Jwt__SecretKey` —— 至少 32 字元隨機字串（`openssl rand -base64 48`）。
    非開發環境若未設定或仍是預設值，程式會拒絕啟動。
  - `ConnectionStrings__Default` —— 資料庫連線字串，請用最小權限帳號。
- 對外請架反向代理（Nginx/Caddy）終止 TLS，並轉發 `X-Forwarded-Proto`。
- 將 `Cors__AllowedOrigins__0` 設為正式網域；登入端點已內建速率限制。

## 專案結構

```
VolleyballTrainingTracker.Server/   # ASP.NET Core 8 Web API
  Auth/                JWT 服務
  Controllers/         Auth, Users, Roles, Profile, Players, Sessions,
                       Drills, MatchEvents, Stats, Maintenance
  Data/
    AppDbContext.cs    EF Core（UseNpgsql）
    Sql/pg_init.sql    ★ PostgreSQL DDL（DB-First 來源）
  Dtos/                Request/Response
  Entities/            EF 實體（User, Role, Player, TrainingSession,
                       Drill, SessionDrill, MatchLog, MatchEvent,
                       MatchEventPlayer, AuditDelete）
  Tools/               SchemaExporter、seed 指令
  Dockerfile.api       Linux 多階段（Render 部署使用）

volleyballtrainingtracker.client/   # React 19 + Vite + TS
  src/
    api/               axios + endpoints
    auth/              ProtectedRoute（角色權限守衛）
    components/ui/     shadcn 元件
    components/        AppLayout、Breadcrumbs、UserGuideDialog 等
    config/nav.ts      側欄導覽設定
    content/           使用者操作手冊內容
    pages/             Login, Dashboard, Players, PlayerEdit,
                       Sessions, SessionEdit, Drills, DrillEdit,
                       MatchLogs, MatchLogEdit, Stats,
                       AdminUsers, AdminRoles, Profile, NoAccess
    stores/authStore.ts
  Schema/              ★ 由 SchemaExporter 產生（勿手改）

VolleyballTrainingTracker.DataMigration/   # 一次性 MSSQL→PG 搬移工具（已執行完畢，保留備用）
docs/操作手冊.md                            # 使用者操作手冊
```

## 資料庫

資料庫為 **PostgreSQL 15**（2026-05-18 由 MSSQL 遷移完成）。結構來源為
`VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql`。舊的 `001~003_*.sql`
與 `Migrations/*.sql` 為 MSSQL 語法，僅作歷史紀錄，勿再套用。詳見
[.claude/CLAUDE.md](.claude/CLAUDE.md)。
