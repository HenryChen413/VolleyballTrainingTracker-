-- =============================================================================
-- 2026-05-22_AddUserLastLoginAt.sql
-- 為 Users 新增「最近一次登入時間 (LastLoginAt)」欄位
--   * timestamptz NULL（UTC；從未登入過為 NULL）
--   * 由 AuthController 於每次成功登入時以 ExecuteUpdate 直接寫入此單一欄位,
--     刻意不觸發 SaveChanges 的 UpdatedAt / UpdatedByUserId 稽核戳記
--     —— 避免「登入」被誤記為一次資料更新
-- 重複執行安全（IF NOT EXISTS）。
-- =============================================================================

BEGIN;

ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "LastLoginAt" timestamptz NULL;

COMMIT;
