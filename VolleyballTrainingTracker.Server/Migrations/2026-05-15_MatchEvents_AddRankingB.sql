-- =============================================
-- 2026-05-15_MatchEvents_AddRankingB.sql
-- MatchEvents 加 RankingB（B 隊名次，僅 SquadCount=2 使用）
-- 原 Ranking 欄在 SquadCount=2 時代表 A 隊名次
-- Idempotent
-- =============================================
USE VolleyballTrainingTracker;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEvents') AND name = N'RankingB')
    ALTER TABLE dbo.MatchEvents ADD RankingB NVARCHAR(64) NULL;
GO
