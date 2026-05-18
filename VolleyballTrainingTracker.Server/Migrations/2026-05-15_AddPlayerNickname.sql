-- =============================================
-- 2026-05-15_AddPlayerNickname.sql
-- 為 Players 加入 Nickname（暱稱）欄位，供 UI 顯示與搜尋使用
-- =============================================
USE VolleyballTrainingTracker;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Players') AND name = N'Nickname')
    ALTER TABLE dbo.Players ADD Nickname NVARCHAR(32) NULL;
GO
