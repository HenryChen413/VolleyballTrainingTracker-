-- =============================================
-- 2026-05-14_MatchLogs_AddTypeAndAcademicYear.sql
-- 1. 新增 MatchType (NVARCHAR(16))：'Official' = 比賽 / 'Friendly' = 友誼賽
-- 2. 新增 AcademicYear (INT)：學年度（例：110），與 Players.Grade 同型態
-- =============================================
USE VolleyballTrainingTracker;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'MatchType')
    ALTER TABLE dbo.MatchLogs ADD MatchType NVARCHAR(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = 'AcademicYear')
    ALTER TABLE dbo.MatchLogs ADD AcademicYear INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_MatchLogs_MatchType'
      AND parent_object_id = OBJECT_ID(N'dbo.MatchLogs')
)
    ALTER TABLE dbo.MatchLogs
        ADD CONSTRAINT CK_MatchLogs_MatchType
        CHECK (MatchType IS NULL OR MatchType IN (N'Official', N'Friendly'));
GO
