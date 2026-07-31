# 部署指南（免費方案）

分離式架構：**前端 Vercel ＋ 後端 Render ＋ 資料庫 Supabase**。

```
GitHub repo
   ├─ Vercel        ← 前端（volleyballtrainingtracker.client）
   └─ Render        ← 後端 API（Dockerfile.api）
         └─ Supabase ← PostgreSQL 17
```

---

## 步驟 0：推上 GitHub

本機已 `git init` 並完成首次 commit。建立 GitHub repo 後：

```powershell
git remote add origin https://github.com/HenryChen413/VolleyballTrainingTracker-.git
git push -u origin main
```

---

## 步驟 1：Supabase（資料庫）

1. 到 <https://supabase.com> 建立新專案，記下你設定的 **資料庫密碼**。
2. 進專案 → **SQL Editor** → 貼上並執行
   `VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql`（建立所有表結構）。
3. 取得連線字串：**Project Settings → Database → Connection string**，
   選 **Session pooler**（埠 5432，相容 IPv4 與 EF Core）。
   Supabase 給的是 URI 格式，需自行改成 Npgsql 的 key-value 格式：

   ```
   Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<projectref>;Password=<你的密碼>;SSL Mode=Require;Trust Server Certificate=true
   ```

   這整串就是後面 Render 要填的 `ConnectionStrings__Default`。

> ⚠️ Supabase 免費版閒置 7 天會自動暫停資料庫，需到後台手動恢復。

---

## 步驟 2：建立系統角色與超級管理員 YUANHE

在**本機**對著 Supabase 跑一次 seed 指令（Render 免費方案不便執行一次性指令）：

```powershell
$env:ConnectionStrings__Default = "Host=...;Port=5432;Database=postgres;Username=postgres.xxx;Password=...;SSL Mode=Require;Trust Server Certificate=true"
dotnet run --project VolleyballTrainingTracker.Server -- seed-roles
dotnet run --project VolleyballTrainingTracker.Server -- seed-user YUANHE "你的管理員密碼" Admin
```

完成後清掉變數：`Remove-Item Env:\ConnectionStrings__Default`

---

## 步驟 3：Render（後端 API）

1. <https://render.com> → **New → Web Service** → 連接此 GitHub repo。
2. 設定：
   - **Runtime**：Docker
   - **Dockerfile Path**：`./VolleyballTrainingTracker.Server/Dockerfile.api`
   - **Docker Build Context Directory**：`.`（專案根目錄）
   - **Region**：Singapore　**Instance Type**：Free
3. **Environment Variables**（Advanced）：

   | Key | Value |
   |-----|-------|
   | `ConnectionStrings__Default` | 步驟 1 的 Supabase 連線字串 |
   | `Jwt__SecretKey` | 至少 32 字元隨機字串（`openssl rand -base64 48`） |
   | `Cors__AllowedOrigins__0` | 先暫填 `https://localhost`，步驟 4 後再回來改 |
   | `Maintenance__Secret` | 維護端點密鑰（隨機長字串），用途見步驟 6 |

   > `DOTNET_hostBuilder__reloadConfigOnChange=false` 已寫死在 `Dockerfile.api`，
   > 不需手動設定（用途見下方備註）。

4. 部署完成後記下後端網址，例如 `https://vbtt-api.onrender.com`。
   開 `https://vbtt-api.onrender.com/health` 應回傳 `{"status":"ok"}`。

> ⚠️ Render 免費版閒置 15 分鐘休眠，下次喚醒約需 30～60 秒。
>
> ⚠️ **inotify 耗盡（exit 139 啟動崩潰）**：Render 主機的
> `fs.inotify.max_user_instances` 額度為整台主機共用。.NET 預設會對
> `appsettings*.json` 開檔案監看（熱重載），額度被鄰居容器吃光時，
> 後端會在 `WebApplication.CreateBuilder` 啟動期拋 `IOException` 並崩潰。
> 已透過 `DOTNET_hostBuilder__reloadConfigOnChange=false`（見 `Dockerfile.api`）
> 停用該監看解決，生產環境本就不需要熱重載設定檔。

---

## 步驟 4：Vercel（前端）

1. <https://vercel.com> → **Add New → Project** → 匯入此 GitHub repo。
2. 設定：
   - **Root Directory**：`volleyballtrainingtracker.client`
   - Framework 會自動偵測為 Vite（`vercel.json` 已含設定）。
3. **Environment Variables**：

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | 步驟 3 的 Render 後端網址（結尾不加斜線） |

4. 部署完成後記下前端網址，例如 `https://vbtt.vercel.app`。

---

## 步驟 5：收尾——把 CORS 指回 Vercel 網址

回到 Render → 該服務 → Environment，把 `Cors__AllowedOrigins__0`
改成步驟 4 的 Vercel 網址（例如 `https://vbtt.vercel.app`），存檔會自動重新部署。

完成後開啟 Vercel 前端網址，用 YUANHE 帳號登入測試。

---

## 步驟 6：排程保活（避免 Supabase 閒置暫停）

Supabase 免費版閒置 7 天會自動暫停，需要外部排程定期產生資料庫活動。

### 排程要打哪裡？

**建議直接打 Supabase，不要透過 Render。**

Render 免費版閒置 15 分鐘就休眠。若排程每天只跑一次，等於**每次都必定打在休眠狀態上**，
每次都要走冷啟喚醒；喚醒失敗時 Render 路由層會直接回 **503**，回應標頭帶
`x-render-routing: hibernate-wake-error`、且沒有 `x-render-origin-server: Kestrel`
—— 代表請求根本沒進到後端。把保活成功率押在平台最不可靠的路徑上，失敗會很頻繁。

在 cron-job.org（或任何排程服務）建立 job：

- **URL**：`https://<projectref>.supabase.co/rest/v1/Roles?select=Id&limit=1`
- **Header**：`apikey: <Supabase publishable / anon key>`
- **頻率**：每天 1 次即可（暫停門檻是 7 天，留足冗餘）

> 設定後先手動執行一次，**看 HTTP 狀態是 200 就成功；回傳 `[]` 空陣列是正常且理想的結果**。
> 空陣列代表 PostgREST 確實查了資料庫（產生保活所需的活動），但 RLS 擋住了資料不外洩 ——
> 本專案所有資料表都是這個狀態，前端是走後端 API 讀資料，不經過 PostgREST。
>
> 若回 401 `No API key found` 是標頭沒帶對；**若真的回傳了資料列，代表該表對 `anon` 開放讀取，
> 那是資安問題**，要去檢查 RLS，而不是拿來當保活目標。

### 替代方案：仍打 Render 維護端點

若你想沿用 `/api/maintenance/keepalive`（它會對資料庫下一次 DELETE，是確實的 DB 活動）：

- **URL**：`https://<你的 Render 網址>/api/maintenance/keepalive`
- **Header**：`X-Maintenance-Key: <Maintenance__Secret 的值>`
- **逾時**：設到上限 **30 秒**。冷啟需 30～60 秒，逾時設太短會把成功的喚醒誤判為失敗。
- **重試**：cron-job.org 沒有自動重試功能，改用「**建第二個 job、時間錯開 10 分鐘**」達成。
  喚醒失敗多半是暫時性的，且第一次呼叫已把服務叫醒，第二次是熱的會秒回。

未設定 `Maintenance__Secret` 時該端點一律回 503（避免無保護裸奔）；
密鑰錯誤則回 404（隱蔽端點存在）。這兩種 503／404 都來自應用程式本身，
回應會帶 `x-render-origin-server: Kestrel`，可據此和上述平台層 503 區分。

> 稽核紀錄清理（清除超過 1 年的 `AuditDeletes`）已由後端的 `AuditCleanupService`
> 背景服務每 24 小時自行執行，**不再依賴這個排程**。排程失敗只影響保活，不影響資料清理。

---

## 環境變數對照表

| 變數 | 設在哪 | 用途 |
|------|--------|------|
| `ConnectionStrings__Default` | Render | Supabase 連線字串 |
| `Jwt__SecretKey` | Render | JWT 簽章金鑰（≥32 字元） |
| `Cors__AllowedOrigins__0` | Render | 允許的前端來源（Vercel 網址） |
| `Maintenance__Secret` | Render | 維護端點 `/api/maintenance/keepalive` 的存取密鑰 |
| `VITE_API_URL` | Vercel | 前端呼叫的後端 API 網址 |

本機開發不需任何上述變數：連線字串與金鑰已在 `appsettings.Development.json`，
前端 `VITE_API_URL` 留空時自動走 Vite dev proxy。
