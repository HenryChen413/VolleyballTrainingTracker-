-- ============================================================================
-- PostgreSQL 17 — 新增「留言板」頁面與管理權限
-- ----------------------------------------------------------------------------
-- 背景：新增 board 頁面與 board.manage 權限後，pg_init.sql / seed-roles 只影響
--       「新建」角色（Admin 例外，seed 會自動補齊）。既有資料庫的其他角色需
--       執行本腳本補上頁面權限。
-- 規則：
--   1) 凡是已能看到 dashboard 的角色，一併開放 board（與 seed-roles 一致，全員可看）。
--   2) Admin 角色額外補上 board.manage（刪他人貼文 / 置頂）。
-- 前置：三張資料表（BoardPosts / BoardComments / BoardReactions）請先以
--       pg_init.sql 建立（該檔為冪等的合併版 DDL）。
-- 冪等：已含 board / board.manage 的角色不會被重複加入。
-- ============================================================================

-- 1) 全員可看：已有 dashboard 的角色補上 board 頁面
UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"dashboard"', '"dashboard","board"')
WHERE "AllowedPages" LIKE '%"dashboard"%'
  AND "AllowedPages" NOT LIKE '%"board"%';

-- 2) Admin 補上 board.manage 管理權限
UPDATE "Roles"
SET "Permissions" = CASE
        WHEN "Permissions" LIKE '[]' OR "Permissions" IS NULL OR btrim("Permissions") = ''
            THEN '["board.manage"]'
        ELSE replace("Permissions", ']', ',"board.manage"]')
    END
WHERE "Name" = 'Admin'
  AND ("Permissions" IS NULL OR "Permissions" NOT LIKE '%"board.manage"%');
