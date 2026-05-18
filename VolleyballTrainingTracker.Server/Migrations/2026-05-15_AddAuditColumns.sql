-- =============================================
-- 2026-05-15_AddAuditColumns.sql
-- 為所有核心資料表加入 CreatedByUserId / UpdatedByUserId
-- 補 Drills / MatchLogs 缺少的 UpdatedAt
-- 新增 AuditDeletes 刪除稽核表
-- =============================================
USE VolleyballTrainingTracker;
GO

-- ---------- Players ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Players') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.Players ADD CreatedByUserId INT NULL
        CONSTRAINT FK_Players_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Players') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.Players ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_Players_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- TrainingSessions ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.TrainingSessions') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.TrainingSessions ADD CreatedByUserId INT NULL
        CONSTRAINT FK_TrainingSessions_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.TrainingSessions') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.TrainingSessions ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_TrainingSessions_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- Drills ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Drills') AND name = N'UpdatedAt')
    ALTER TABLE dbo.Drills ADD UpdatedAt DATETIME2(0) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Drills') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.Drills ADD CreatedByUserId INT NULL
        CONSTRAINT FK_Drills_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Drills') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.Drills ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_Drills_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- MatchLogs ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'UpdatedAt')
    ALTER TABLE dbo.MatchLogs ADD UpdatedAt DATETIME2(0) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.MatchLogs ADD CreatedByUserId INT NULL
        CONSTRAINT FK_MatchLogs_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.MatchLogs') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.MatchLogs ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_MatchLogs_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- SessionDrills ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.SessionDrills') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.SessionDrills ADD CreatedByUserId INT NULL
        CONSTRAINT FK_SessionDrills_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- Users ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.Users ADD CreatedByUserId INT NULL
        CONSTRAINT FK_Users_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.Users ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_Users_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- Roles ----------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Roles') AND name = N'CreatedByUserId')
    ALTER TABLE dbo.Roles ADD CreatedByUserId INT NULL
        CONSTRAINT FK_Roles_CreatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Roles') AND name = N'UpdatedByUserId')
    ALTER TABLE dbo.Roles ADD UpdatedByUserId INT NULL
        CONSTRAINT FK_Roles_UpdatedBy FOREIGN KEY REFERENCES dbo.Users(Id);
GO

-- ---------- AuditDeletes ----------
IF OBJECT_ID(N'dbo.AuditDeletes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditDeletes
    (
        Id                BIGINT          IDENTITY(1,1) NOT NULL,
        TableName         NVARCHAR(64)    NOT NULL,
        RowId             INT             NOT NULL,
        DeletedByUserId   INT             NULL,
        DeletedAt         DATETIME2(0)    NOT NULL CONSTRAINT DF_AuditDeletes_DeletedAt DEFAULT (SYSUTCDATETIME()),
        RowJson           NVARCHAR(MAX)   NULL,
        CONSTRAINT PK_AuditDeletes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_AuditDeletes_User FOREIGN KEY (DeletedByUserId) REFERENCES dbo.Users(Id)
    );
    CREATE INDEX IX_AuditDeletes_Table_Row ON dbo.AuditDeletes(TableName, RowId);
END
GO
