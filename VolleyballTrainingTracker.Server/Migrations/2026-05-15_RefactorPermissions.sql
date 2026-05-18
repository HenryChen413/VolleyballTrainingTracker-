-- =============================================================================
-- 2026-05-15_RefactorPermissions.sql
--
-- 權限模型重構：
--   舊：players.create/update/delete、sessions.create/update/delete、
--       drills.create/update/delete、matchlogs.create/update/delete、
--       sessions.drills.write（孤兒，移除）
--   新：players.edit、sessions.edit、drills.edit、matchlogs.edit
--   保留：players.purge、users.manage、roles.manage
--
-- 規則：舊權限只要有任一個（create/update/delete），新角色就取得對應的 .edit。
-- 同時順便加入 Captain / ViceCaptain 兩個系統角色（IsSystem=1）。
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. 為每個 Role 重建 Permissions JSON --------------------------------------
;WITH detected AS (
    SELECT
        Id,
        CASE WHEN Permissions LIKE N'%"players.create"%'
              OR Permissions LIKE N'%"players.update"%'
              OR Permissions LIKE N'%"players.delete"%'
              OR Permissions LIKE N'%"players.edit"%'   THEN 1 ELSE 0 END AS HasPlayersEdit,
        CASE WHEN Permissions LIKE N'%"sessions.create"%'
              OR Permissions LIKE N'%"sessions.update"%'
              OR Permissions LIKE N'%"sessions.delete"%'
              OR Permissions LIKE N'%"sessions.edit"%'  THEN 1 ELSE 0 END AS HasSessionsEdit,
        CASE WHEN Permissions LIKE N'%"drills.create"%'
              OR Permissions LIKE N'%"drills.update"%'
              OR Permissions LIKE N'%"drills.delete"%'
              OR Permissions LIKE N'%"drills.edit"%'    THEN 1 ELSE 0 END AS HasDrillsEdit,
        CASE WHEN Permissions LIKE N'%"matchlogs.create"%'
              OR Permissions LIKE N'%"matchlogs.update"%'
              OR Permissions LIKE N'%"matchlogs.delete"%'
              OR Permissions LIKE N'%"matchlogs.edit"%' THEN 1 ELSE 0 END AS HasMatchLogsEdit,
        CASE WHEN Permissions LIKE N'%"players.purge"%' THEN 1 ELSE 0 END AS HasPlayersPurge,
        CASE WHEN Permissions LIKE N'%"users.manage"%'  THEN 1 ELSE 0 END AS HasUsersManage,
        CASE WHEN Permissions LIKE N'%"roles.manage"%'  THEN 1 ELSE 0 END AS HasRolesManage
    FROM dbo.Roles
)
UPDATE r
   SET Permissions =
       CASE
         WHEN d.HasPlayersEdit + d.HasPlayersPurge + d.HasSessionsEdit
            + d.HasDrillsEdit + d.HasMatchLogsEdit
            + d.HasUsersManage + d.HasRolesManage = 0
         THEN N'[]'
         ELSE N'['
              + STUFF(
                  CASE WHEN d.HasPlayersEdit   = 1 THEN N',"players.edit"'   ELSE N'' END
                + CASE WHEN d.HasPlayersPurge  = 1 THEN N',"players.purge"'  ELSE N'' END
                + CASE WHEN d.HasSessionsEdit  = 1 THEN N',"sessions.edit"'  ELSE N'' END
                + CASE WHEN d.HasDrillsEdit    = 1 THEN N',"drills.edit"'    ELSE N'' END
                + CASE WHEN d.HasMatchLogsEdit = 1 THEN N',"matchlogs.edit"' ELSE N'' END
                + CASE WHEN d.HasUsersManage   = 1 THEN N',"users.manage"'   ELSE N'' END
                + CASE WHEN d.HasRolesManage   = 1 THEN N',"roles.manage"'   ELSE N'' END
                , 1, 1, N'')
              + N']'
       END
  FROM dbo.Roles r
  JOIN detected d ON d.Id = r.Id;

-- 2. 新增 Captain / ViceCaptain 系統角色（若不存在） -------------------------
DECLARE @EmptyPerms NVARCHAR(MAX) = N'[]';
DECLARE @CaptainPages NVARCHAR(MAX) = N'["dashboard","players","sessions","drills","profile"]';

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'Captain')
    INSERT INTO dbo.Roles(Name, Description, AllowedPages, Permissions, IsSystem)
    VALUES (N'Captain',     N'隊長（不可刪）',   @CaptainPages, @EmptyPerms, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N'ViceCaptain')
    INSERT INTO dbo.Roles(Name, Description, AllowedPages, Permissions, IsSystem)
    VALUES (N'ViceCaptain', N'副隊長（不可刪）', @CaptainPages, @EmptyPerms, 1);

COMMIT TRAN;
PRINT '[Migration] Permissions refactored to edit-based model; Captain/ViceCaptain seeded.';
