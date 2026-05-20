-- =============================================================================
-- 2026-05-20_AddPlayerStudentId.sql
-- 為 Players 新增「學號 (StudentId)」欄位
--   * varchar(32) NULL
--   * 唯一索引（容許多筆 NULL，僅針對有值的列強制唯一）
--   * 若 Player 已綁定 User（UserId 非 NULL）則用該 User 的 UserName 回填
--     —— 因為現況「帳號名稱 = 學號」
-- 重複執行安全（全部 IF NOT EXISTS）。
-- =============================================================================

BEGIN;

-- 1) 新增欄位
ALTER TABLE "Players"
    ADD COLUMN IF NOT EXISTS "StudentId" varchar(32) NULL;

-- 2) 從綁定的 User.UserName 回填（僅 StudentId 為 NULL 時）
UPDATE "Players" AS p
SET    "StudentId" = u."UserName"
FROM   "Users" AS u
WHERE  p."UserId" = u."Id"
  AND  p."StudentId" IS NULL
  AND  u."UserName" IS NOT NULL
  AND  length(trim(u."UserName")) > 0;

-- 3) 唯一索引（partial index：跳過 NULL，允許多筆未填學號的列）
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Players_StudentId"
    ON "Players"("StudentId")
    WHERE "StudentId" IS NOT NULL;

COMMIT;
