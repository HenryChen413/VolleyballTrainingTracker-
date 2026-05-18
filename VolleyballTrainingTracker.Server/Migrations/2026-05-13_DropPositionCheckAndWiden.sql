-- 移除位置的 CHECK 條件約束（改為支援逗號分隔多選，如 OH,MB）
ALTER TABLE dbo.Players DROP CONSTRAINT CK_Players_Position;

-- 欄位加寬以容納多選字串（最長：OH,OPP,MB,S,L,DS = 19 字元，留緩衝）
ALTER TABLE dbo.Players ALTER COLUMN Position NVARCHAR(64) NULL;
