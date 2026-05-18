-- =============================================
-- 2026-05-14_MatchLogs_AddColumns.sql
-- 1. 將 Result CHECK 從 Win/Loss/Draw 改為 W/L/D
-- 2. 新增欄位（跳過已存在的欄位）
-- =============================================
USE VolleyballTrainingTracker;
GO

-- 1. 移除舊 CHECK 條件約束（若存在）
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_MatchLogs_Result'
      AND parent_object_id = OBJECT_ID(N'dbo.MatchLogs')
)
    ALTER TABLE dbo.MatchLogs DROP CONSTRAINT CK_MatchLogs_Result;
GO

-- 2. 新增欄位（逐一判斷是否已存在）
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'MatchName')
    ALTER TABLE dbo.MatchLogs ADD MatchName NVARCHAR(128) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'VideoUrl')
    ALTER TABLE dbo.MatchLogs ADD VideoUrl NVARCHAR(512) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Ranking')
    ALTER TABLE dbo.MatchLogs ADD Ranking NVARCHAR(64) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set1Our')
    ALTER TABLE dbo.MatchLogs ADD Set1Our INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set1Opp')
    ALTER TABLE dbo.MatchLogs ADD Set1Opp INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set2Our')
    ALTER TABLE dbo.MatchLogs ADD Set2Our INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set2Opp')
    ALTER TABLE dbo.MatchLogs ADD Set2Opp INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set3Our')
    ALTER TABLE dbo.MatchLogs ADD Set3Our INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Set3Opp')
    ALTER TABLE dbo.MatchLogs ADD Set3Opp INT NULL;
GO

-- 3. 若 Ranking 舊欄位是 INT，需先刪除再重建為 NVARCHAR
-- （如果之前是照舊指示建成 INT 的話才需要執行這段）
DECLARE @rankingType NVARCHAR(32);
SELECT @rankingType = TYPE_NAME(system_type_id)
FROM sys.columns
WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'Ranking';

IF @rankingType = 'int'
BEGIN
    ALTER TABLE dbo.MatchLogs DROP COLUMN Ranking;
    ALTER TABLE dbo.MatchLogs ADD Ranking NVARCHAR(64) NULL;
END
GO

-- 4. 加入新的 CHECK 條件約束（W / L / D）
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_MatchLogs_Result'
      AND parent_object_id = OBJECT_ID(N'dbo.MatchLogs')
)
    ALTER TABLE dbo.MatchLogs
        ADD CONSTRAINT CK_MatchLogs_Result
        CHECK (Result IS NULL OR Result IN (N'W', N'L', N'D'));
GO
