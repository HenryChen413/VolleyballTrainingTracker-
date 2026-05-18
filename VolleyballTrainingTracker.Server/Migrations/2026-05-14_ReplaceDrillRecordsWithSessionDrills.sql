-- =============================================================================
-- 2026-05-14_ReplaceDrillRecordsWithSessionDrills.sql
-- 移除動作量化紀錄（DrillRecords，含 PlayerId/Attempts/Successes/Score），
-- 改為訓練 <-> 訓練項目 多對多關聯（SessionDrills）。
-- 既有 DrillRecords 中 (SessionId, DrillId) 的 distinct 配對會遷移到 SessionDrills。
-- 角色權限字串 sessions.drillrecords.write 改為 sessions.drills.write。
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

-- 1. 建立 SessionDrills 表
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

-- 2. 遷移既有資料（distinct 配對）
IF OBJECT_ID(N'dbo.DrillRecords', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.SessionDrills (SessionId, DrillId, CreatedAt)
    SELECT DISTINCT r.SessionId, r.DrillId, SYSUTCDATETIME()
    FROM dbo.DrillRecords r
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.SessionDrills sd
        WHERE sd.SessionId = r.SessionId AND sd.DrillId = r.DrillId
    );
END

-- 3. 移除 DrillRecords
IF OBJECT_ID(N'dbo.DrillRecords', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.DrillRecords;
END

-- 4. 角色 Permissions JSON 內字串替換
UPDATE dbo.Roles
   SET Permissions = REPLACE(Permissions, N'sessions.drillrecords.write', N'sessions.drills.write')
 WHERE Permissions LIKE N'%sessions.drillrecords.write%';

COMMIT TRAN;
PRINT '[Migration] DrillRecords replaced by SessionDrills; permission key renamed.';
