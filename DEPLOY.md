# 部署指南（免費方案）

分離式架構：**前端 Vercel ＋ 後端 Render ＋ 資料庫 Supabase**。

```
GitHub repo
   ├─ Vercel        ← 前端（volleyballtrainingtracker.client）
   └─ Render        ← 後端 API（Dockerfile.api）
         └─ Supabase ← PostgreSQL 15
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

4. 部署完成後記下後端網址，例如 `https://vbtt-api.onrender.com`。
   開 `https://vbtt-api.onrender.com/health` 應回傳 `{"status":"ok"}`。

> ⚠️ Render 免費版閒置 15 分鐘休眠，下次喚醒約需 30～60 秒。

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

## 環境變數對照表

| 變數 | 設在哪 | 用途 |
|------|--------|------|
| `ConnectionStrings__Default` | Render | Supabase 連線字串 |
| `Jwt__SecretKey` | Render | JWT 簽章金鑰（≥32 字元） |
| `Cors__AllowedOrigins__0` | Render | 允許的前端來源（Vercel 網址） |
| `VITE_API_URL` | Vercel | 前端呼叫的後端 API 網址 |

本機開發不需任何上述變數：連線字串與金鑰已在 `appsettings.Development.json`，
前端 `VITE_API_URL` 留空時自動走 Vite dev proxy。
