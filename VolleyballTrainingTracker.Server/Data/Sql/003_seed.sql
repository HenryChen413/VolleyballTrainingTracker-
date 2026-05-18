-- =============================================
-- 003_seed.sql
-- Seed Drills catalog
-- =============================================
USE VolleyballTrainingTracker;
GO

MERGE dbo.Drills AS T
USING (VALUES
    (N'發球練習',         N'Serve'),
    (N'跳發',             N'Serve'),
    (N'接發球',           N'Pass'),
    (N'防守接球',         N'Dig'),
    (N'舉球',             N'Set'),
    (N'快攻',             N'Attack'),
    (N'四號位扣球',       N'Attack'),
    (N'二號位扣球',       N'Attack'),
    (N'攔網',             N'Block'),
    (N'核心肌群',         N'Fitness'),
    (N'敏捷訓練',         N'Fitness')
) AS S (Name, Category)
ON T.Name = S.Name
WHEN NOT MATCHED THEN
    INSERT (Name, Category) VALUES (S.Name, S.Category);
GO
