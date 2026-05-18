-- =============================================================================
-- 2026-05-13_AddRolesPermissions.sql
-- 為 RBAC 新增 Roles 表，並把 Users.Role(string) 改成 Users.RoleId(FK)
--
-- 執行方式：在 SSMS / sqlcmd 對應的 DB 上一次執行整個 script。
-- 預設交易包覆，遇到錯誤會自動 ROLLBACK。
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. Roles 表 ------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'Roles')
BEGIN
    CREATE TABLE dbo.Roles
    (
        Id            INT             IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name          NVARCHAR(32)    NOT NULL,
        Description   NVARCHAR(256)   NULL,
        AllowedPages  NVARCHAR(MAX)   NOT NULL CONSTRAINT DF_Roles_AllowedPages DEFAULT (N'[]'),
        Permissions   NVARCHAR(MAX)   NOT NULL CONSTRAINT DF_Roles_Permissions  DEFAULT (N'[]'),
        IsSystem      BIT             NOT NULL CONSTRAINT DF_Roles_IsSystem DEFAULT (0),
        CreatedAt     DATETIME2(0)    NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt     DATETIME2(0)    NULL
    );
    CREATE UNIQUE INDEX UX_Roles_Name ON dbo.Roles(Name);
END;

-- 2. 內建三組系統角色 -----------------------------------------------------------
-- Admin：所有權限、所有頁面
-- Coach：原 Coach 行為（CRUD players/sessions/drills），可看主功能頁
-- Player：唯讀 + 個人 Profile
DECLARE @AllPerms NVARCHAR(MAX) = N'["players.create","players.update","players.delete","sessions.create","sessions.update","sessions.delete","sessions.drillrecords.write","drills.create","drills.update","drills.delete","users.manage","roles.manage"]';
DECLARE @AllPages NVARCHAR(MAX) = N'["dashboard","players","sessions","stats","admin-roles","admin-users","profile"]';

DECLARE @CoachPerms NVARCHAR(MAX) = N'["players.create","players.update","players.delete","sessions.create","sessions.update","sessions.delete","sessions.drillrecords.write"]';
DECLARE @CoachPages NVARCHAR(MAX) = N'["dashboard","players","sessions","stats","profile"]';

DECLARE @PlayerPerms NVARCHAR(MAX) = N'[]';
DECLARE @PlayerPages NVARCHAR(MAX) = N'["dashboard","players","sessions","stats","profile"]';

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'Admin')
    INSERT INTO dbo.Roles(Name, Description, AllowedPages, Permissions, IsSystem)
    VALUES (N'Admin',  N'系統管理員（不可刪）',  @AllPages,   @AllPerms,   1);

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'Coach')
    INSERT INTO dbo.Roles(Name, Description, AllowedPages, Permissions, IsSystem)
    VALUES (N'Coach',  N'教練（不可刪）',        @CoachPages, @CoachPerms, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'Player')
    INSERT INTO dbo.Roles(Name, Description, AllowedPages, Permissions, IsSystem)
    VALUES (N'Player', N'選手（不可刪）',        @PlayerPages,@PlayerPerms,1);

-- 3. Users.RoleId 欄位 ----------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'RoleId'
)
BEGIN
    ALTER TABLE dbo.Users ADD RoleId INT NULL;
END;

-- 4. Backfill：把舊的 Role 字串對應到 RoleId
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'Role'
)
BEGIN
    -- 用 EXEC 延遲編譯，避免 Role 欄位已不存在時 SQL Server 預先驗證失敗
    EXEC(N'UPDATE u SET u.RoleId = r.Id FROM dbo.Users u JOIN dbo.Roles r ON r.Name = u.Role WHERE u.RoleId IS NULL');

    -- 仍未對應到的（資料有髒值），先指向 Player 角色，避免後續 NOT NULL 失敗
    UPDATE u
       SET u.RoleId = (SELECT Id FROM dbo.Roles WHERE Name = N'Player')
      FROM dbo.Users u
     WHERE u.RoleId IS NULL;
END
ELSE
BEGIN
    -- 沒有舊欄位（首次安裝或已遷移過）：把任何空 RoleId 都補成 Player
    UPDATE dbo.Users
       SET RoleId = (SELECT Id FROM dbo.Roles WHERE Name = N'Player')
     WHERE RoleId IS NULL;
END;

-- 5. 將 RoleId 設為 NOT NULL 並加上 FK
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'RoleId' AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.Users ALTER COLUMN RoleId INT NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Users_Roles_RoleId'
)
BEGIN
    ALTER TABLE dbo.Users
        ADD CONSTRAINT FK_Users_Roles_RoleId FOREIGN KEY (RoleId)
            REFERENCES dbo.Roles(Id);
END;

-- 6. 丟掉舊的 Users.Role 字串欄位（已遷移完成）-----------------------------------
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'Role'
)
BEGIN
    -- 先刪可能的索引/預設值（這欄位先前沒有索引，但保險起見抓 default）
    DECLARE @dfName NVARCHAR(256);
    SELECT @dfName = dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c
        ON c.default_object_id = dc.object_id
     WHERE c.object_id = OBJECT_ID(N'dbo.Users') AND c.name = N'Role';
    IF @dfName IS NOT NULL
        EXEC(N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + @dfName);

    ALTER TABLE dbo.Users DROP COLUMN Role;
END;

COMMIT TRAN;
PRINT '[Migration] Roles/Permissions schema applied.';
