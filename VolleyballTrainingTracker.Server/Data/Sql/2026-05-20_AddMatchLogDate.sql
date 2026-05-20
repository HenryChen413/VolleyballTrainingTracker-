-- ============================================================================
-- PostgreSQL 17 — MatchLogs 新增子層日期欄位 "MatchDate"
-- ----------------------------------------------------------------------------
-- 背景：賽事可能跨多天，MatchEvent.MatchDate 改視為「起始日」，
--       由每筆對戰自帶實際日期。僅限 MatchType=Official 才允許填寫，
--       友誼賽 / 未填類型一律保持 NULL（後端 Controller 已守門）。
-- 規則：欄位可為 NULL；既有資料維持 NULL，UI 自動 fallback 顯示起始日。
-- 冪等：使用 ADD COLUMN IF NOT EXISTS。
-- ============================================================================

ALTER TABLE "MatchLogs"
    ADD COLUMN IF NOT EXISTS "MatchDate" date NULL;
