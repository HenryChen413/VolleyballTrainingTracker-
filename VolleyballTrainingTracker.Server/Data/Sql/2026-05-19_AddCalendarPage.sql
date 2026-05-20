-- ============================================================================
-- PostgreSQL 17 — 新增「行事曆」頁面權限
-- ----------------------------------------------------------------------------
-- 背景：新增 calendar 頁面後，pg_init.sql / seed-roles 只影響「新建」角色。
--       既有資料庫的角色 AllowedPages 不會自動更新，需執行本腳本補上。
-- 規則：凡是已能看到 dashboard 的角色，一併開放 calendar（與 seed-roles 一致）。
--       Admin 角色擁有全部頁面，本腳本同樣會正確補上。
-- 冪等：已含 calendar 的角色不會被重複加入。
-- ============================================================================

UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"dashboard"', '"dashboard","calendar"')
WHERE "AllowedPages" LIKE '%"dashboard"%'
  AND "AllowedPages" NOT LIKE '%"calendar"%';
