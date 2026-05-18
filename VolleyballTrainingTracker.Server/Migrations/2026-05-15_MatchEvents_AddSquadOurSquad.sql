-- =============================================
-- 2026-05-15_MatchEvents_AddSquadOurSquad.sql
-- 1. MatchEvents 加 SquadCount（出賽隊數，預設 1）
-- 2. MatchEventPlayers 加 OurSquad（個別球員所屬分隊，可空）
-- 既有資料完全相容：SquadCount=1、OurSquad=NULL
-- Idempotent
-- =============================================
USE VolleyballTrainingTracker;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. MatchEvents.SquadCount
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEvents') AND name = N'SquadCount')
BEGIN
    ALTER TABLE dbo.MatchEvents ADD SquadCount INT NOT NULL
        CONSTRAINT DF_MatchEvents_SquadCount DEFAULT (1);
END
GO

-- 2. MatchEventPlayers.OurSquad
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEventPlayers') AND name = N'OurSquad')
    ALTER TABLE dbo.MatchEventPlayers ADD OurSquad NVARCHAR(16) NULL;
GO

COMMIT TRAN;
GO
