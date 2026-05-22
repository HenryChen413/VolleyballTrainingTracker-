-- ============================================================================
-- PostgreSQL 17 — 新增「隊費贊助榜」頁面與編輯權限
-- ----------------------------------------------------------------------------
-- 背景：新增 sponsors 頁面與 sponsors.edit 權限後，pg_init.sql / seed-roles 只影響
--       「新建」角色（Admin 例外，seed 會自動補齊）。既有資料庫的其他角色需
--       執行本腳本補上頁面與權限。
-- 規則：
--   1) 凡是已能看到 dashboard 的角色，一併開放 sponsors 頁面（全員可看芳名榜）。
--   2) Admin 與 Coach 額外補上 sponsors.edit（新增/修改/刪除贊助者與紀錄）。
--   3) 移除已淘汰的 Sponsors."GraduationYear"（屆別）欄位（若既有 DB 曾建立）。
-- 前置：兩張資料表（Sponsors / Sponsorships）請先以 pg_init.sql 建立（冪等合併版 DDL）。
-- 冪等：已含 sponsors / sponsors.edit 的角色不會被重複加入；DROP COLUMN 用 IF EXISTS。
-- ============================================================================

-- 1) 全員可看：已有 dashboard 的角色補上 sponsors 頁面
UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"dashboard"', '"dashboard","sponsors"')
WHERE "AllowedPages" LIKE '%"dashboard"%'
  AND "AllowedPages" NOT LIKE '%"sponsors"%';

-- 2) Admin / Coach 補上 sponsors.edit 編輯權限
UPDATE "Roles"
SET "Permissions" = CASE
        WHEN "Permissions" LIKE '[]' OR "Permissions" IS NULL OR btrim("Permissions") = ''
            THEN '["sponsors.edit"]'
        ELSE replace("Permissions", ']', ',"sponsors.edit"]')
    END
WHERE "Name" IN ('Admin', 'Coach')
  AND ("Permissions" IS NULL OR "Permissions" NOT LIKE '%"sponsors.edit"%');

-- 3) 移除已淘汰的「屆別」欄位（若既有資料庫已建立 Sponsors 表含此欄）
ALTER TABLE IF EXISTS "Sponsors" DROP COLUMN IF EXISTS "GraduationYear";
