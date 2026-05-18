-- =============================================
-- 2026-05-15_MatchEventPlayers_AddSnapshot.sql
-- 在 MatchEventPlayers 加 snapshot 欄位（PlayerName / JerseyNo / Position）
-- 目的：歷史比賽紀錄即使球員之後改位置/背號/姓名也不會變動
-- 步驟：
--   1. 加欄位（PlayerName 先 NULL，回填後改 NOT NULL）
--   2. 從 Players 表回填既有列
--   3. PlayerName 改 NOT NULL
-- 本 script idempotent，可重複執行
-- =============================================
USE VolleyballTrainingTracker;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. 加欄位
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEventPlayers') AND name = N'PlayerName')
    ALTER TABLE dbo.MatchEventPlayers ADD PlayerName NVARCHAR(64) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEventPlayers') AND name = N'JerseyNo')
    ALTER TABLE dbo.MatchEventPlayers ADD JerseyNo INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchEventPlayers') AND name = N'Position')
    ALTER TABLE dbo.MatchEventPlayers ADD Position NVARCHAR(64) NULL;
GO

-- 2. 從 Players 表回填（只回填 snapshot 尚未填的列）
UPDATE mep
SET
    mep.PlayerName = p.Name,
    mep.JerseyNo   = p.JerseyNo,
    mep.Position   = p.Position
FROM dbo.MatchEventPlayers mep
JOIN dbo.Players p ON p.Id = mep.PlayerId
WHERE mep.PlayerName IS NULL;
GO

-- 3. PlayerName 改 NOT NULL（只有所有列都已回填才執行）
IF NOT EXISTS (SELECT 1 FROM dbo.MatchEventPlayers WHERE PlayerName IS NULL)
   AND EXISTS (
       SELECT 1 FROM sys.columns
       WHERE object_id = OBJECT_ID(N'dbo.MatchEventPlayers')
         AND name = N'PlayerName'
         AND is_nullable = 1
   )
    ALTER TABLE dbo.MatchEventPlayers ALTER COLUMN PlayerName NVARCHAR(64) NOT NULL;
GO

COMMIT TRAN;
GO
