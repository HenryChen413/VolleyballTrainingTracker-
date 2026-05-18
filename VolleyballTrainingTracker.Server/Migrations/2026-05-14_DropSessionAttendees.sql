-- =============================================================================
-- 2026-05-14_DropSessionAttendees.sql
-- 移除出席紀錄：刪除 SessionAttendees 資料表，並從現有角色 Permissions JSON
-- 移除 "sessions.attendees.write" 字串。
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. 移除 SessionAttendees 資料表（含 FK / 索引一併移除）
IF OBJECT_ID(N'dbo.SessionAttendees', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.SessionAttendees;
END

-- 2. 清掉角色裡殘留的 sessions.attendees.write 權限字串
UPDATE dbo.Roles
   SET Permissions = REPLACE(REPLACE(REPLACE(Permissions,
                              N'"sessions.attendees.write",', N''),
                              N',"sessions.attendees.write"', N''),
                              N'"sessions.attendees.write"',  N'')
 WHERE Permissions LIKE N'%sessions.attendees.write%';

COMMIT TRAN;
PRINT '[Migration] SessionAttendees dropped, attendees permission removed.';
