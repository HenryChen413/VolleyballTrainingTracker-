-- 新增「Basic（基礎）」訓練分類
ALTER TABLE dbo.Drills DROP CONSTRAINT CK_Drills_Category;
GO

ALTER TABLE dbo.Drills
    ADD CONSTRAINT CK_Drills_Category
    CHECK (Category IN (N'Basic', N'Serve', N'Pass', N'Set', N'Attack', N'Block', N'Dig', N'Fitness'));
GO
