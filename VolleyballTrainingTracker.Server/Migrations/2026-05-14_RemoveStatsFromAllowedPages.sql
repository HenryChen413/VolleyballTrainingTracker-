-- =============================================================================
-- 2026-05-14_RemoveStatsFromAllowedPages.sql
-- 把所有角色 (dbo.Roles) 的 AllowedPages JSON 陣列中已退役的 "stats" 字串徹底清掉。
-- 統計頁面已合併進儀表板，PAGE.Stats 在前後端皆已移除。
--
-- 執行方式：在 SSMS / sqlcmd 對應的 DB 上一次執行整個 script。
-- 預設交易包覆，遇到錯誤會自動 ROLLBACK。
-- 重複執行安全（idempotent）：第二次執行時 WHERE EXISTS 條件不命中，等於 no-op。
-- =============================================================================
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE r
SET
    AllowedPages = ISNULL(x.cleaned, N'[]'),
    UpdatedAt    = SYSUTCDATETIME()
FROM dbo.Roles r
CROSS APPLY (
    SELECT N'[' + STRING_AGG(N'"' + j.[value] + N'"', N',') + N']' AS cleaned
    FROM OPENJSON(r.AllowedPages) j
    WHERE j.[value] <> N'stats'
) x
WHERE EXISTS (
    SELECT 1 FROM OPENJSON(r.AllowedPages) WHERE [value] = N'stats'
);

DECLARE @n INT = @@ROWCOUNT;

COMMIT TRAN;
PRINT CONCAT('[Migration] Removed "stats" from AllowedPages in ', @n, ' role(s).');
