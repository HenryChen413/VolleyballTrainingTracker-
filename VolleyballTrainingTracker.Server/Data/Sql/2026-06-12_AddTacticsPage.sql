-- ============================================================================
-- PostgreSQL 17 — 新增「戰術板」頁面（tactics）
-- ----------------------------------------------------------------------------
-- 背景：新增 tactics 頁面後，seed-roles 只影響「新建」角色（Admin 例外，
--       seed 會自動補齊 Pages.All）。既有資料庫的其他角色需執行本腳本補上頁面。
-- 規則：戰術板定位為全員可看可編（排陣、戰術討論），凡是已能看到 dashboard
--       的角色一併開放 tactics，與 seed-roles 的預設一致。
--       本頁面無獨立的 edit 權限（Permissions 不變）。
-- 冪等：已含 tactics 的角色不會被重複加入。
-- ============================================================================

UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"dashboard"', '"dashboard","tactics"')
WHERE "AllowedPages" LIKE '%"dashboard"%'
  AND "AllowedPages" NOT LIKE '%"tactics"%';
