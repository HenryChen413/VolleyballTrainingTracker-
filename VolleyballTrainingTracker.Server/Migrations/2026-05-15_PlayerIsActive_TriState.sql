-- 將 Players.IsActive 從 BIT 改為 TINYINT 三態：
--   1 = 現役（預設）
--   0 = 畢業
--   2 = 退隊
USE VolleyballTrainingTracker;
GO

-- 1. 移除預設值約束（才能改型別）
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Players_IsActive')
    ALTER TABLE dbo.Players DROP CONSTRAINT DF_Players_IsActive;
GO

-- 2. 改欄位型別 BIT -> TINYINT
ALTER TABLE dbo.Players ALTER COLUMN IsActive TINYINT NOT NULL;
GO

-- 3. 補回預設值
ALTER TABLE dbo.Players
    ADD CONSTRAINT DF_Players_IsActive DEFAULT (1) FOR IsActive;
GO

-- 4. 加上 CHECK 限制只能為 0/1/2
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Players_IsActive')
    ALTER TABLE dbo.Players
        ADD CONSTRAINT CK_Players_IsActive CHECK (IsActive IN (0, 1, 2));
GO
