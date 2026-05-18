-- =============================================================================
-- 2026-05-13_SetYuanheAdmin.sql
-- 將 YUANHE 帳號的角色改為 Admin
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE dbo.Users
   SET RoleId = (SELECT Id FROM dbo.Roles WHERE Name = N'Admin')
 WHERE UserName = N'YUANHE';

IF @@ROWCOUNT = 0
    RAISERROR(N'找不到帳號 YUANHE，請確認帳號存在且已大寫。', 16, 1);

COMMIT TRAN;
PRINT '[Migration] YUANHE 已設為 Admin 角色。';
