# 變更日誌（CHANGELOG）

本檔記錄「高醫醫學女排‧排球訓練紀錄」對使用者有感的功能與重要技術變更。
格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；日期為台灣時間（UTC+8）。

> 本日誌自 **2026-05-22** 起開始記錄；更早的歷史請參閱 Git 提交紀錄。

---

## [2026-05-22]

### 新增
- **使用者最近登入時間**
  - 登入成功時記錄該次登入時間。
  - 「使用者管理」頁新增 **最近登入** 欄位：以相對時間呈現（如「3 天前」），滑鼠移上可看完整日期時間；從未登入過的帳號顯示「從未登入」。
  - 「最近登入」欄可排序（從未登入者視為最早），並新增 **「僅顯示從未登入者」** 開關（標籤顯示人數），方便找出尚未登入過的帳號。

### 技術
- `Users` 資料表新增 `LastLoginAt`（`timestamptz`、可空、UTC）欄位；增量腳本：`VolleyballTrainingTracker.Server/Data/Sql/2026-05-22_AddUserLastLoginAt.sql`。
- 登入流程改以 EF Core `ExecuteUpdate` 只更新 `LastLoginAt` 單一欄位，刻意不觸發 `SaveChanges` 的 `UpdatedAt` / `UpdatedByUserId` 稽核戳記，避免「登入」被誤記為一次資料更新。

### 移除
- 刪除前端 `volleyballtrainingtracker.client/Schema/` 死檔資料夾（自動匯出產物，內容為早期 SQL Server 殘留、與現行 PostgreSQL 結構不符，且前端未實際引用）。

---

*高醫醫學女排‧排球訓練紀錄 — 變更日誌　著作權所有 © 陳源和*
