-- =============================================
-- 002_core_tables.sql
-- Players / TrainingSessions / Drills / SessionDrills / MatchLogs
-- =============================================
USE VolleyballTrainingTracker;
GO

-- ---------- Players ----------
IF OBJECT_ID(N'dbo.Players', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Players
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        UserId          INT             NULL,                 -- optional link to Users
        Name            NVARCHAR(64)    NOT NULL,
        JerseyNo        INT             NULL,
        Position        NVARCHAR(16)    NULL,                 -- OH/OPP/MB/S/L
        HeightCm        INT             NULL,
        WeightKg        INT             NULL,
        DominantHand    NVARCHAR(8)     NULL,                 -- Left/Right
        BirthDate       DATE            NULL,
        JoinedAt        DATE            NOT NULL CONSTRAINT DF_Players_JoinedAt DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
        IsActive        TINYINT         NOT NULL CONSTRAINT DF_Players_IsActive DEFAULT (1), -- 1=現役 / 0=畢業 / 2=退隊
        Notes           NVARCHAR(512)   NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_Players_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(0)    NULL,
        CONSTRAINT PK_Players PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Players_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT CK_Players_Position CHECK (Position IS NULL OR Position IN (N'OH', N'OPP', N'MB', N'S', N'L', N'DS')),
        CONSTRAINT CK_Players_DominantHand CHECK (DominantHand IS NULL OR DominantHand IN (N'Left', N'Right')),
        CONSTRAINT CK_Players_IsActive CHECK (IsActive IN (0, 1, 2))
    );
    CREATE INDEX IX_Players_UserId ON dbo.Players(UserId);
END
GO

-- ---------- Drills ----------
IF OBJECT_ID(N'dbo.Drills', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Drills
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        Name            NVARCHAR(64)    NOT NULL,
        Category        NVARCHAR(32)    NOT NULL,             -- Basic/Serve/Pass/Set/Attack/Block/Dig/Fitness
        Description     NVARCHAR(512)   NULL,
        IsActive        BIT             NOT NULL CONSTRAINT DF_Drills_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_Drills_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Drills PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Drills_Name UNIQUE (Name),
        CONSTRAINT CK_Drills_Category CHECK (Category IN (N'Basic', N'Serve', N'Pass', N'Set', N'Attack', N'Block', N'Dig', N'Fitness'))
    );
END
GO

-- ---------- TrainingSessions ----------
IF OBJECT_ID(N'dbo.TrainingSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TrainingSessions
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        SessionDate     DATE            NOT NULL,
        StartTime       TIME(0)         NULL,
        DurationMin     INT             NULL,
        Location        NVARCHAR(128)   NULL,
        Theme           NVARCHAR(128)   NULL,
        CoachUserId     INT             NOT NULL,
        Notes           NVARCHAR(1024)  NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_TrainingSessions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt       DATETIME2(0)    NULL,
        CONSTRAINT PK_TrainingSessions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TrainingSessions_Users FOREIGN KEY (CoachUserId) REFERENCES dbo.Users(Id)
    );
    CREATE INDEX IX_TrainingSessions_Date ON dbo.TrainingSessions(SessionDate DESC);
END
GO

-- ---------- SessionDrills (Session <-> Drill many-to-many) ----------
IF OBJECT_ID(N'dbo.SessionDrills', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SessionDrills
    (
        SessionId       INT             NOT NULL,
        DrillId         INT             NOT NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_SessionDrills_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_SessionDrills PRIMARY KEY CLUSTERED (SessionId, DrillId),
        CONSTRAINT FK_SessionDrills_Session FOREIGN KEY (SessionId) REFERENCES dbo.TrainingSessions(Id) ON DELETE CASCADE,
        CONSTRAINT FK_SessionDrills_Drill   FOREIGN KEY (DrillId)   REFERENCES dbo.Drills(Id)
    );
    CREATE INDEX IX_SessionDrills_Drill ON dbo.SessionDrills(DrillId);
END
GO

-- ---------- MatchLogs (M5/optional) ----------
IF OBJECT_ID(N'dbo.MatchLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MatchLogs
    (
        Id              INT             IDENTITY(1,1) NOT NULL,
        MatchDate       DATE            NOT NULL,
        Opponent        NVARCHAR(128)   NOT NULL,
        OurScore        INT             NULL,
        OpponentScore   INT             NULL,
        Result          NVARCHAR(8)     NULL,                 -- Win/Loss/Draw
        Location        NVARCHAR(128)   NULL,
        Notes           NVARCHAR(1024)  NULL,
        CreatedAt       DATETIME2(0)    NOT NULL CONSTRAINT DF_MatchLogs_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_MatchLogs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT CK_MatchLogs_Result CHECK (Result IS NULL OR Result IN (N'Win', N'Loss', N'Draw'))
    );
END
GO
