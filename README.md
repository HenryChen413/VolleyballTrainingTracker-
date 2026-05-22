# 高醫醫學女排‧排球訓練紀錄

ASP.NET Core 8 + React 19（Vite + TS）+ PostgreSQL 17 的排球訓練紀錄系統。

> 版權所有 — 本系統著作權屬陳源和所有，未經授權請勿使用。

## 技術棧

| 層 | 內容 |
|----|------|
| 前端 | React 19、Vite、TypeScript、Tailwind CSS、shadcn/ui、zustand、recharts、axios |
| 後端 | ASP.NET Core 8 Web API、EF Core 8、JWT 驗證 |
| 資料庫 | PostgreSQL 17（`Npgsql.EntityFrameworkCore.PostgreSQL`） |
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

### 3. 啟動後端 + 前端
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

## 測試與品質

| 範圍 | 指令 | 工具 |
|------|------|------|
| 前端單元測試 | `cd volleyballtrainingtracker.client && npm run test` | Vitest + Testing Library |
| 前端測試（watch） | `npm run test:watch` | Vitest |
| 前端覆蓋率 | `npm run test:coverage` | Vitest（v8） |
| 前端無障礙 | 隨 `npm run test` 一併執行（`*.a11y.test.tsx`） | vitest-axe / axe-core |
| 後端單元測試 | `dotnet test VolleyballTrainingTracker.Server.Tests` | xUnit |

- CI：每次推送與 PR 會由 GitHub Actions（[.github/workflows/ci.yml](.github/workflows/ci.yml)）執行前後端的 lint／test／build。
- 程式碼風格由根目錄 `.editorconfig` 統一；後端已啟用 .NET 分析器（`AnalysisLevel=latest-recommended`）。
- 可觀測性：後端以 Serilog 輸出結構化日誌，並整合 OpenTelemetry 追蹤／指標；
  設定環境變數 `OTEL_EXPORTER_OTLP_ENDPOINT` 後即會把資料匯出到 OTLP collector。

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

docs/操作手冊.md                            # 使用者操作手冊
docs/CHANGELOG.md                           # 變更日誌
```

## 資料庫

資料庫為 **PostgreSQL 17**。結構來源為
`VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql`，後續 schema 變更以
`Data/Sql/YYYY-MM-DD_*.sql` 增量腳本累加。詳見 [.claude/CLAUDE.md](.claude/CLAUDE.md)。
