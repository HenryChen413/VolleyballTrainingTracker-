-- =============================================
-- 2026-05-15_MatchEvents_Refactor.sql
-- 將 MatchLogs 拆成父子兩層：
--   MatchEvents       一場賽事（含名稱、日期、地點、影片、備註、名次、學年度、種類）
--   MatchEventPlayers 該場賽事出賽名單（M:N）
--   MatchLogs         每筆對戰（瘦身：FK + 對手 + 比分 + OurSquad）
-- 步驟：
--   1. 建 MatchEvents、MatchEventPlayers
--   2. 從現有 MatchLogs 聚合出 MatchEvents（依日期/名稱/地點/名次/種類/學年度）
--   3. MatchLogs 新增 MatchEventId、OurSquad 欄位
--   4. 回填 MatchLogs.MatchEventId
--   5. MatchEventId 設為 NOT NULL 並加 FK
--   6. DROP MatchLogs 中已搬到 MatchEvents 的欄位
-- 本 script idempotent，可重複執行
-- =============================================
USE VolleyballTrainingTracker;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

-- ---------- 1. MatchEvents ----------
IF OBJECT_ID(N'dbo.MatchEvents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MatchEvents
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        MatchDate       DATE            NOT NULL,
        MatchType       NVARCHAR(16)    NULL,                 -- Official / Friendly
        AcademicYear    INT             NULL,
        MatchName       NVARCHAR(128)   NULL,
        Location        NVARCHAR(128)   NULL,
        Ranking         NVARCHAR(64)    NULL,
        VideoUrl        NVARCHAR(512)   NULL,
        Notes           NVARCHAR(1024)  NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_MatchEvents_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(0)    NULL,
        CreatedByUserId INT             NULL,
        UpdatedByUserId INT             NULL,
        CONSTRAINT PK_MatchEvents PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_MatchEvents_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_MatchEvents_UpdatedBy FOREIGN KEY (UpdatedByUserId) REFERENCES dbo.Users(Id)
    );
    CREATE INDEX IX_MatchEvents_Date ON dbo.MatchEvents(MatchDate DESC);
END
GO

-- ---------- 2. MatchEventPlayers ----------
IF OBJECT_ID(N'dbo.MatchEventPlayers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MatchEventPlayers
    (
        MatchEventId    INT             NOT NULL,
        PlayerId        INT             NOT NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_MatchEventPlayers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_MatchEventPlayers PRIMARY KEY CLUSTERED (MatchEventId, PlayerId),
        CONSTRAINT FK_MatchEventPlayers_Event  FOREIGN KEY (MatchEventId) REFERENCES dbo.MatchEvents(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MatchEventPlayers_Player FOREIGN KEY (PlayerId)     REFERENCES dbo.Players(Id)     ON DELETE CASCADE
    );
    CREATE INDEX IX_MatchEventPlayers_Player ON dbo.MatchEventPlayers(PlayerId);
END
GO

-- ---------- 3. MatchLogs 新增欄位 ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'MatchEventId')
    ALTER TABLE dbo.MatchLogs ADD MatchEventId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'OurSquad')
    ALTER TABLE dbo.MatchLogs ADD OurSquad NVARCHAR(16) NULL;
GO

-- ---------- 4. 聚合既有 MatchLogs → MatchEvents（僅當尚未遷移）----------
-- 透過 INSERT ... SELECT 把 distinct group 塞進 MatchEvents
-- 再 UPDATE MatchLogs.MatchEventId 連回
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'MatchDate')
   AND EXISTS (SELECT 1 FROM dbo.MatchLogs WHERE MatchEventId IS NULL)
BEGIN
    -- 用每組最小 Id 的那筆當代表（VideoUrl/Notes 來自最早一筆，與既有 UI 行為一致）
    ;WITH G AS (
        SELECT
            MIN(Id)         AS RepId,
            MatchDate,
            MatchType,
            AcademicYear,
            ISNULL(MatchName, N'')  AS GMatchName,
            ISNULL(Location,  N'')  AS GLocation,
            ISNULL(Ranking,   N'')  AS GRanking
        FROM dbo.MatchLogs
        WHERE MatchEventId IS NULL
        GROUP BY
            MatchDate,
            MatchType,
            AcademicYear,
            ISNULL(MatchName, N''),
            ISNULL(Location,  N''),
            ISNULL(Ranking,   N'')
    )
    INSERT INTO dbo.MatchEvents
        (MatchDate, MatchType, AcademicYear, MatchName, Location, Ranking, VideoUrl, Notes,
         CreatedAt, UpdatedAt, CreatedByUserId, UpdatedByUserId)
    SELECT
        ml.MatchDate,
        ml.MatchType,
        ml.AcademicYear,
        ml.MatchName,
        ml.Location,
        ml.Ranking,
        ml.VideoUrl,
        ml.Notes,
        ISNULL(ml.CreatedAt, SYSUTCDATETIME()),
        ml.UpdatedAt,
        ml.CreatedByUserId,
        ml.UpdatedByUserId
    FROM G
    JOIN dbo.MatchLogs ml ON ml.Id = G.RepId;

    -- 回填 MatchLogs.MatchEventId
    UPDATE ml
    SET ml.MatchEventId = me.Id
    FROM dbo.MatchLogs ml
    JOIN dbo.MatchEvents me
        ON me.MatchDate          = ml.MatchDate
       AND ISNULL(me.MatchType,    N'') = ISNULL(ml.MatchType,    N'')
       AND ISNULL(me.AcademicYear, -1)  = ISNULL(ml.AcademicYear, -1)
       AND ISNULL(me.MatchName,    N'') = ISNULL(ml.MatchName,    N'')
       AND ISNULL(me.Location,     N'') = ISNULL(ml.Location,     N'')
       AND ISNULL(me.Ranking,      N'') = ISNULL(ml.Ranking,      N'')
    WHERE ml.MatchEventId IS NULL;
END
GO

-- ---------- 5. MatchEventId 設為 NOT NULL + FK（只在所有列已回填後）----------
IF NOT EXISTS (SELECT 1 FROM dbo.MatchLogs WHERE MatchEventId IS NULL)
BEGIN
    -- 改為 NOT NULL
    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.MatchLogs')
          AND name = N'MatchEventId'
          AND is_nullable = 1
    )
        ALTER TABLE dbo.MatchLogs ALTER COLUMN MatchEventId INT NOT NULL;

    -- 加 FK
    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_MatchLogs_Event'
          AND parent_object_id = OBJECT_ID(N'dbo.MatchLogs')
    )
        ALTER TABLE dbo.MatchLogs
            ADD CONSTRAINT FK_MatchLogs_Event
            FOREIGN KEY (MatchEventId) REFERENCES dbo.MatchEvents(Id) ON DELETE CASCADE;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_MatchLogs_Event'
          AND object_id = OBJECT_ID(N'dbo.MatchLogs')
    )
        CREATE INDEX IX_MatchLogs_Event ON dbo.MatchLogs(MatchEventId);
END
GO

-- ---------- 6. DROP MatchLogs 中已搬到 MatchEvents 的欄位 ----------
-- 注意：必須先處理可能存在的 DEFAULT 條件約束
DECLARE @sql NVARCHAR(MAX);

-- 6a. 先 drop 各欄位身上的 DEFAULT constraint（若有）
DECLARE @colsToDrop TABLE (Name SYSNAME);
INSERT @colsToDrop VALUES
    (N'MatchDate'), (N'MatchType'), (N'AcademicYear'),
    (N'MatchName'), (N'Location'), (N'Ranking'),
    (N'VideoUrl'),  (N'Notes');

DECLARE @colName SYSNAME, @dfName SYSNAME;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT c.Name FROM @colsToDrop c;
OPEN cur;
FETCH NEXT FROM cur INTO @colName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @dfName = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns col ON col.object_id = dc.parent_object_id AND col.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.MatchLogs')
      AND col.name = @colName;

    IF @dfName IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.MatchLogs DROP CONSTRAINT ' + QUOTENAME(@dfName);
        EXEC sp_executesql @sql;
        SET @dfName = NULL;
    END
    FETCH NEXT FROM cur INTO @colName;
END
CLOSE cur; DEALLOCATE cur;
GO

-- 6b. DROP 欄位
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'MatchType')
    ALTER TABLE dbo.MatchLogs DROP COLUMN MatchType;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'AcademicYear')
    ALTER TABLE dbo.MatchLogs DROP COLUMN AcademicYear;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'MatchName')
    ALTER TABLE dbo.MatchLogs DROP COLUMN MatchName;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'Location')
    ALTER TABLE dbo.MatchLogs DROP COLUMN Location;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'Ranking')
    ALTER TABLE dbo.MatchLogs DROP COLUMN Ranking;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'VideoUrl')
    ALTER TABLE dbo.MatchLogs DROP COLUMN VideoUrl;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'Notes')
    ALTER TABLE dbo.MatchLogs DROP COLUMN Notes;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'MatchDate')
    ALTER TABLE dbo.MatchLogs DROP COLUMN MatchDate;
GO

COMMIT TRAN;
GO
