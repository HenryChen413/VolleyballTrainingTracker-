-- ============================================================================
-- PostgreSQL 17 — 接發站位新增第四套體系「主攻1＋主攻2＋副攻」（receive-2oh-opp）
-- ----------------------------------------------------------------------------
-- 背景：2026-10-19_AddFormations.sql 已在正式 DB 執行（Key 白名單為四值），
--       新增體系需放寬 "Formations"."Key" 的 CHECK。
-- 前置：先執行 2026-10-19_AddFormations.sql。
-- 冪等：CHECK 先刪後建；不更動任何既有資料。
-- ============================================================================

BEGIN;

ALTER TABLE "Formations" DROP CONSTRAINT IF EXISTS "CK_Formations_Key";
ALTER TABLE "Formations" ADD CONSTRAINT "CK_Formations_Key"
    CHECK ("Key" IN ('defense','receive-2oh','receive-oh1-opp','receive-oh2-opp','receive-2oh-opp'));

COMMIT;
