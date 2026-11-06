# 比賽記錄單（即時填寫） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把紙本比賽記錄單搬進系統：每場對戰（`MatchLog`）可逐局即時填寫球員技術劃記與比分發展，局分自動回填，並提供整場合計。

**Architecture:** 後端新增 `"MatchScoreSheets"` 表（一局一筆，jsonb `Content`＋`Version` 樂觀並行），純邏輯集中在 `ScoreSheets/ScoreSheetRules.cs`（驗證、局號規則、回填）以便單元測試，控制器保持薄。前端純邏輯集中在 `src/lib/scoresheet/`（欄位常數、文件操作、比分發展排版、合計、本機暫存），頁面只組裝 UI。

**Tech Stack:** ASP.NET Core 8、EF Core 8 + Npgsql（PostgreSQL 17）、xUnit；React 19 + Vite + TS、Tailwind + shadcn 元件、vitest + Testing Library。

**Spec:** `docs/superpowers/specs/2026-11-05-match-scoresheet-design.md`

## Global Constraints

- 所有 UI 文字與註解使用繁體中文。
- SQL 識別字 PascalCase 並加雙引號；增量腳本 `Data/Sql/2026-11-05_AddMatchScoreSheets.sql` 必須可重複執行（`IF NOT EXISTS`），並同步更新 `pg_init.sql`；新表**不**補 anon GRANT。
- 稽核欄位（`CreatedAt/UpdatedAt/CreatedByUserId/UpdatedByUserId`）由 `AppDbContext.SaveChangesAsync` 自動維護，控制器不得手動指派。
- 權限：全部端點 `[RequirePage(Pages.MatchLogs)]`，**不新增** Permission 常數。
- `setIndex` 範圍 1–50；新增時必須＝目前最大局號＋1；只能刪除最大局號。
- `Content` 原始 JSON 上限 65536 bytes；`rally` 只允許 `"U" | "O" | "TU" | "TO"`；`lineup` 長度 6；counts 為非負整數。
- 回填**只寫局分**：正式賽（`MatchType != "Friendly"`）第 1–3 局寫 `Set{n}Our/Opp`、第 4 局以上不寫；友誼賽寫 `"MatchLogSets"`（不存在就新增）。**不動** `OurScore`、`OpponentScore`、`Result`。`rally` 中無任何 `U`/`O` 時不回填。
- 前端本機暫存每次變動立即寫入 localStorage，上傳 debounce 1000ms。
- 交付前必須跑 `dotnet test` 與 client 的 `npm test`、`npx tsc -b`、`npm run lint`。

## Review Focus

1. **離線後重新整理頁面**：本機有未同步內容時，重新開啟要以本機內容為準並自動重送，不可被伺服器舊版蓋掉 → Task 4 測試 `prefers newer local draft over server on load`。
2. **長按與點擊衝突**：長按 −1 後放開不可再觸發 +1；計數不可低於 0 → Task 5 測試 `long press decrements once and does not also increment`、`decrement stops at zero`。
3. **對手只有暫停、沒有得分**：`rally` 只有 `TU/TO` 時不回填、頁首比分為 0:0 → Task 1 `ComputeFinalScore_OnlyTimeouts_ReturnsNull`、Task 3 `score of timeouts-only rally is 0:0`。
4. **同一球員被加入兩次**：「＋隊員」不可列出已加入者；合計以 `playerId` 合併不重複 → Task 3 `addRow ignores duplicate player`、`sumSheets merges rows by playerId`。
5. **409 衝突後選「用我的覆蓋」**：要以伺服器回傳的 version 作為 `expectedVersion` 重送，而非無限 409 → Task 4 `overwrite after conflict resends with server version`。

---

## File Structure

**後端（`VolleyballTrainingTracker.Server/`）**
- Create `Entities/MatchScoreSheet.cs` — 實體
- Create `ScoreSheets/ScoreSheetRules.cs` — 驗證、局號規則、最後比分、回填（純靜態）
- Create `Dtos/MatchScoreSheetDtos.cs` — DTO
- Create `Controllers/MatchScoreSheetsController.cs`
- Create `Data/Sql/2026-11-05_AddMatchScoreSheets.sql`
- Modify `Data/AppDbContext.cs`（DbSet＋設定）、`Data/Sql/pg_init.sql`、`Entities/MatchLog.cs`（導覽屬性）、`Dtos/MatchLogDtos.cs`＋`Controllers/MatchEventsController.cs`（`SheetCount`）
- Test `VolleyballTrainingTracker.Server.Tests/ScoreSheets/ScoreSheetRulesTests.cs`

**前端（`volleyballtrainingtracker.client/src/`）**
- Create `lib/scoresheet/columns.ts` — 欄位常數
- Create `lib/scoresheet/sheet.ts` — 文件型別與純函式操作
- Create `lib/scoresheet/rally.ts` — 比分發展排版與比分計算
- Create `lib/scoresheet/totals.ts` — 整場合計
- Create `lib/scoresheet/useSheetSync.ts` — 本機暫存＋debounce 上傳＋衝突
- Create `api/scoreSheets.ts`
- Create `components/scoresheet/StatGrid.tsx`、`RallyStrip.tsx`、`LineupGrid.tsx`、`RotateHint.tsx`、`useLongPress.ts`
- Create `pages/MatchScoreSheet.tsx`（單局）、`pages/MatchScoreSheets.tsx`（列表＋合計）
- Modify `App.tsx`（路由）、`pages/MatchLogs.tsx`（入口按鈕）、`api/matchLogs.ts`（`sheetCount`）
- Tests 與各檔同目錄 `*.test.ts(x)`

---

### Task 1: 後端資料表、實體與規則

**Files:**
- Create: `VolleyballTrainingTracker.Server/Entities/MatchScoreSheet.cs`
- Create: `VolleyballTrainingTracker.Server/ScoreSheets/ScoreSheetRules.cs`
- Create: `VolleyballTrainingTracker.Server/Data/Sql/2026-11-05_AddMatchScoreSheets.sql`
- Modify: `VolleyballTrainingTracker.Server/Data/AppDbContext.cs`（DbSet 區、`MatchLogSet` 設定之後）
- Modify: `VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql`（`"MatchLogSets"` 之後加表；外鍵區加 FK）
- Modify: `VolleyballTrainingTracker.Server/Entities/MatchLog.cs`
- Test: `VolleyballTrainingTracker.Server.Tests/ScoreSheets/ScoreSheetRulesTests.cs`

**Interfaces:**
- Produces:
  - `class MatchScoreSheet { int Id; int MatchLogId; short SetIndex; string? RecorderName; string Content = "{}"; int Version; DateTime CreatedAt; DateTime? UpdatedAt; int? CreatedByUserId; int? UpdatedByUserId; MatchLog? MatchLog; User? UpdatedByUser; }`
  - `MatchLog.ScoreSheets : ICollection<MatchScoreSheet>`
  - `AppDbContext.MatchScoreSheets : DbSet<MatchScoreSheet>`
  - `static class ScoreSheetRules`（namespace `VolleyballTrainingTracker.Server.ScoreSheets`）：
    - `const int MaxSetIndex = 50; const int MaxContentBytes = 65536;`
    - `string? ValidateContent(JsonElement content)` — 錯誤訊息（繁中）或 null
    - `string? ValidateNewSetIndex(int setIndex, int currentMax)` — 新增時用
    - `bool CanDelete(int setIndex, int currentMax)`
    - `(int Our, int Opp)? ComputeFinalScore(JsonElement content)` — 數 `rally` 的 U/O；兩者皆 0 回 null
    - `void ApplyBackfill(MatchLog log, string? matchType, int setIndex, int our, int opp)`

- [ ] **Step 1: 寫失敗測試**（xUnit，風格比照 `Formations/FormationRulesTests.cs`）

```csharp
// ValidateContent
[Fact] ValidateContent_Minimal_IsValid
  // {"lineup":[null,null,null,null,null,null],"rows":[],"oppErrors":0,"ourErrors":0,"rally":[]} → null
[Theory] ValidateContent_Invalid_ReturnsMessage
  // "[]"、缺 rally、rally 含 "X"、lineup 長度 5、counts 值 -1、counts 值 1.5、oppErrors -1、rows[].playerId 缺 → NotNull
[Fact] ValidateContent_TooLarge_ReturnsMessage   // rows 塞到 GetRawText 超過 65536 bytes

// 局號
[Theory] ValidateNewSetIndex
  // (1,0)→null; (2,1)→null; (3,1)→NotNull; (1,1)→NotNull; (51,50)→NotNull; (0,0)→NotNull
[Theory] CanDelete
  // (3,3)→true; (2,3)→false

// 比分
[Fact] ComputeFinalScore_CountsPointsIgnoringTimeouts   // ["U","U","TO","O","U"] → (3,1)
[Fact] ComputeFinalScore_OnlyTimeouts_ReturnsNull       // ["TU","TO"] → null
[Fact] ComputeFinalScore_Empty_ReturnsNull

// 回填
[Fact] ApplyBackfill_Official_Set2_WritesSet2Columns    // matchType "Official", set 2, 25:18 → Set2Our=25, Set2Opp=18；Set1/3 不變
[Fact] ApplyBackfill_NullMatchType_TreatedAsOfficial
[Fact] ApplyBackfill_Official_Set4_DoesNothing
[Fact] ApplyBackfill_Friendly_AddsMissingSet            // Sets 空，set 5 → 新增 SetIndex=5
[Fact] ApplyBackfill_Friendly_UpdatesExistingSet        // 既有 SetIndex=2 (10:10) → 25:20，Sets.Count 不變
[Fact] ApplyBackfill_DoesNotTouchTotalsOrResult         // OurScore=2, OpponentScore=1, Result="W" 保持不變
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests --filter ScoreSheetRulesTests`
Expected: 編譯失敗（`ScoreSheetRules` 不存在）

- [ ] **Step 3: 實作實體、DbContext 設定與 `ScoreSheetRules`**

DbContext 設定：`ToTable("MatchScoreSheets")`；`RecorderName` max 64；`Content` `jsonb` required；`Version` `IsConcurrencyToken()`；唯一索引 `(MatchLogId, SetIndex)` 名稱 `UX_MatchScoreSheets_LogSet`；FK MatchLog cascade（`WithMany(m => m.ScoreSheets)`）；`UpdatedByUser` NoAction。`ValidateContent` 以 `GetRawText()` 的 UTF-8 byte 數判斷大小。

- [ ] **Step 4: 撰寫 SQL**

增量腳本（`BEGIN; … COMMIT;`，表頭註解比照 `2026-10-19_AddFormations.sql`）：

```sql
CREATE TABLE IF NOT EXISTS "MatchScoreSheets" (
    "Id"              integer       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "MatchLogId"      integer       NOT NULL,
    "SetIndex"        smallint      NOT NULL,
    "RecorderName"    varchar(64)   NULL,
    "Content"         jsonb         NOT NULL,
    "Version"         integer       NOT NULL DEFAULT 1,
    "CreatedAt"       timestamptz   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "UpdatedAt"       timestamptz   NULL,
    "CreatedByUserId" integer       NULL,
    "UpdatedByUserId" integer       NULL,
    CONSTRAINT "CK_MatchScoreSheets_SetIndex" CHECK ("SetIndex" BETWEEN 1 AND 50)
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_MatchScoreSheets_LogSet" ON "MatchScoreSheets"("MatchLogId","SetIndex");
-- DO $$ 區塊：FK_MatchScoreSheets_MatchLog (ON DELETE CASCADE)、FK_MatchScoreSheets_UpdatedBy → "Users"
```

`pg_init.sql` 加入相同 DDL 與 FK（放在對應區段）。EF 的 CHECK 以 `HasCheckConstraint` 同步。

- [ ] **Step 5: 跑測試確認通過**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests`
Expected: 全部 PASS

- [ ] **Step 6: Commit** — `feat(server): 新增比賽記錄單資料表與規則`

---

### Task 2: 後端 API 與 `SheetCount`

**Files:**
- Create: `VolleyballTrainingTracker.Server/Dtos/MatchScoreSheetDtos.cs`
- Create: `VolleyballTrainingTracker.Server/Controllers/MatchScoreSheetsController.cs`
- Modify: `VolleyballTrainingTracker.Server/Dtos/MatchLogDtos.cs`（`MatchLogItemDto` 加 `int SheetCount`）
- Modify: `VolleyballTrainingTracker.Server/Controllers/MatchEventsController.cs`（`List` 與 `Get` 的 `MatchLogItemDto` 投影加 `SheetCount = m.ScoreSheets.Count`）

**Interfaces:**
- Consumes: Task 1 的 `ScoreSheetRules`、`MatchScoreSheet`
- Produces（JSON camelCase）：
  - `GET /api/matchlogs/{matchLogId}/sheets` → `MatchScoreSheetsResponse { int MatchLogId; int MatchEventId; string Opponent; DateTime MatchDate /* MatchLog.MatchDate ?? MatchEvent.MatchDate */; string? MatchType; string? OurSquad; List<SheetRosterPlayerDto> Roster; List<MatchScoreSheetDto> Sheets /* SetIndex 升冪 */ }`
  - `SheetRosterPlayerDto { int PlayerId; string Name; int? JerseyNo; string? Position }` — 來自 `MatchEventPlayers`；`MatchLog.OurSquad` 非 null 時只列同 `OurSquad`；結果為空時改列 `Players.IsActive == 1` 全部
  - `MatchScoreSheetDto { int SetIndex; string? RecorderName; JsonElement Content; int Version; DateTime UpdatedAt /* UpdatedAt ?? CreatedAt */; string? UpdatedByName }`
  - `PUT /api/matchlogs/{matchLogId}/sheets/{setIndex}` body `MatchScoreSheetSaveRequest { string? RecorderName; JsonElement Content; int ExpectedVersion /* 新建為 0 */ }` → 200 `MatchScoreSheetDto`；400 `{message}`；404；409 `{ message, version, updatedAt, updatedByName }`
  - `DELETE /api/matchlogs/{matchLogId}/sheets/{setIndex}` → 204；非最大局號 400

- [ ] **Step 1: 實作控制器**

`[ApiController][Authorize][RequirePage(Pages.MatchLogs)][Route("api/matchlogs/{matchLogId:int}/sheets")]`。PUT 流程：載入 `MatchLog`（`Include(MatchEvent)`、`Include(Sets)`）不存在回 404 → `ValidateContent` → 取該對戰現有最大局號 → 不存在該局則 `ExpectedVersion` 必須為 0 且 `ValidateNewSetIndex` 通過；存在則 `ExpectedVersion == Version` 否則 409 → 寫入（新建 `Version=1`，否則 +1；`RecorderName` trim 後截 64、空字串轉 null）→ `ComputeFinalScore` 非 null 時 `ApplyBackfill(log, log.MatchEvent.MatchType, setIndex, …)` → 一次 `SaveChangesAsync`。`DbUpdateConcurrencyException` 與 UniqueViolation 比照 `FormationsController` 轉 409。

- [ ] **Step 2: 編譯與既有測試**

Run: `dotnet build VolleyballTrainingTracker.Server && dotnet test VolleyballTrainingTracker.Server.Tests`
Expected: Build succeeded、全部 PASS

- [ ] **Step 3: 手動驗證（本機 PG17 port 5433，套用增量腳本後啟動後端）**

以 Swagger 或 curl 依序：PUT set 1（expectedVersion 0，rally `["U","O","U"]`）→ 200 version 1，且 `GET /api/matchevents/{id}` 該對戰 `set1Our=2, set1Opp=1, sheetCount=1`；再 PUT set 1 expectedVersion 0 → 409；PUT set 3 → 400；DELETE set 1 → 204。
Expected: 結果如上

- [ ] **Step 4: Commit** — `feat(server): 比賽記錄單 API 與局分回填`

---

### Task 3: 前端記錄單文件模型（純邏輯）

**Files:**
- Create: `src/lib/scoresheet/columns.ts`、`sheet.ts`、`rally.ts`、`totals.ts`
- Test: `src/lib/scoresheet/sheet.test.ts`、`rally.test.ts`、`totals.test.ts`

**Interfaces:**
- Produces:
  - `columns.ts`：`type StatKey = 'serveO'|'serveX'|'atkO'|'atkNo'|'atkOut'|'tipO'|'tipX'|'recvX'|'digMiss'|'digShank'|'freeX'|'setX'|'blockO'|'blockX'|'coverX'|'fault'`；`STAT_GROUPS: { title: string; cols: { key: StatKey; label: string }[] }[]`，依序與標題／子標題：發球（O、X）、攻擊/舉球（O、no、out）、吊球（O、X）、接發（X）、接扣（未、噴）、接小（X）、修正（X）、攔網（O、X）、Cover/鬆把（X）、犯規（空字串）；`STAT_KEYS: StatKey[]`（攤平順序）
  - `sheet.ts`：
    - `type RallyItem = 'U'|'O'|'TU'|'TO'`
    - `interface SheetRow { playerId: number; name: string; jerseyNo: number | null; counts: Partial<Record<StatKey, number>> }`
    - `interface SheetContent { lineup: (number|null)[] /* 6，索引 0..5 = 1..6 號位 */; rows: SheetRow[]; oppErrors: number; ourErrors: number; rally: RallyItem[] }`
    - `emptyContent(): SheetContent`
    - `addRow(c, p: { playerId; name; jerseyNo }): SheetContent`（已存在則原樣回傳）
    - `removeRow(c, playerId): SheetContent`（同時清掉 `lineup` 中該球員）
    - `bumpStat(c, playerId, key, delta: 1 | -1): SheetContent`（不低於 0）
    - `bumpErrors(c, side: 'opp'|'our', delta: 1 | -1): SheetContent`（不低於 0）
    - `setLineup(c, slot: number /* 0..5 */, playerId: number | null): SheetContent`
    - `pushRally(c, item: RallyItem): SheetContent`；`popRally(c): SheetContent`
    - `normalizeContent(raw: unknown): SheetContent`（伺服器／本機資料容錯，缺欄位補預設）
  - `rally.ts`：
    - `scoreOf(rally): { our: number; opp: number }`
    - `interface RallyCell { our: string; opp: string; timeout: 'U'|'O'|null }`
    - `layoutRally(rally): RallyCell[]` — 每個項目一欄：`U` → `{our: 累計我方分, opp: ''}`；`O` → 反之；`TU`/`TO` → `{our:'', opp:'', timeout}`
  - `totals.ts`：`sumSheets(sheets: SheetContent[]): { rows: SheetRow[] /* 依第一次出現順序 */; oppErrors: number; ourErrors: number }`

- [ ] **Step 1: 寫失敗測試**

```ts
// sheet.test.ts
it('addRow ignores duplicate player')            // 加兩次同 playerId → rows.length 1
it('bumpStat increments and creates counts')     // bumpStat(c,7,'serveO',1) ×2 → counts.serveO === 2
it('decrement stops at zero')                    // bumpStat(c,7,'serveX',-1) → 0（或 undefined 視為 0）
it('removeRow clears lineup slot')               // setLineup(c,0,7) 後 removeRow(c,7) → lineup[0] === null
it('popRally on empty is a no-op')
it('normalizeContent fills defaults')            // normalizeContent({}) 深等於 emptyContent()
it('functions do not mutate input')              // Object.freeze 輸入不拋錯

// rally.test.ts
it('layouts staggered running score')
  // ['U','U','U','O','O','U','O'] → our: ['1','2','3','','','4',''], opp: ['','','','1','2','','3']
it('timeout occupies its own column')            // ['U','TO','O'] → [ {our:'1'}, {timeout:'O'}, {opp:'1'} ]
it('score of timeouts-only rally is 0:0')

// totals.test.ts
it('sumSheets merges rows by playerId')          // 兩局皆有 7 號 serveO 1、2 → 3；只出現一局的球員照列
it('sumSheets sums errors')
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- src/lib/scoresheet`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作四個檔案**（全部不可變更新）

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- src/lib/scoresheet`
Expected: PASS

- [ ] **Step 5: Commit** — `feat(client): 比賽記錄單文件模型與比分發展排版`

---

### Task 4: API client 與本機暫存同步

**Files:**
- Create: `src/api/scoreSheets.ts`
- Create: `src/lib/scoresheet/useSheetSync.ts`
- Modify: `src/api/matchLogs.ts`（`MatchLogItem` 加 `sheetCount: number`）
- Test: `src/lib/scoresheet/useSheetSync.test.ts`

**Interfaces:**
- Consumes: Task 3 `SheetContent`、`normalizeContent`；Task 2 API 合約
- Produces:
  - `scoreSheetsApi.list(matchLogId): Promise<MatchScoreSheetsResponse>`；`.save(matchLogId, setIndex, body: { recorderName: string|null; content: SheetContent; expectedVersion: number }): Promise<MatchScoreSheetDto>`；`.remove(matchLogId, setIndex): Promise<void>`
  - `getSheetConflict(err): { message; version; updatedAt; updatedByName } | null`（比照 `getFormationConflict`）
  - TS 型別 `MatchScoreSheetsResponse`、`MatchScoreSheetDto`、`SheetRosterPlayer`（欄位同 Task 2）
  - `useSheetSync(args: { matchLogId: number; setIndex: number; server: MatchScoreSheetDto | null }): { content: SheetContent; recorderName: string|null; status: 'saved'|'pending'|'saving'|'offline'|'conflict'; conflict: { version: number; updatedByName: string|null } | null; update(fn: (c: SheetContent) => SheetContent): void; setRecorderName(n: string|null): void; resolveConflict(choice: 'mine'|'server'): void; }`
  - localStorage key：`scoresheet:${matchLogId}:${setIndex}`，值 `{ content, recorderName, baseVersion, dirty: boolean, savedAt: number }`；所有讀寫包 try/catch。

行為：
- 載入：本機有 `dirty: true` 的草稿 → 用本機內容、`baseVersion` 用草稿的，並立即排程上傳；否則用伺服器內容。
- `update` / `setRecorderName`：同步寫 localStorage（`dirty: true`），重設 1000ms debounce 計時器。
- 上傳成功：`baseVersion = 回傳 version`、`dirty: false`、status `saved`。網路錯誤：status `offline`，5 秒後重試；`window` `online` 事件立即重試。409：status `conflict`，保存衝突資訊，停止自動重試。
- `resolveConflict('mine')`：以衝突回傳的 `version` 為 `expectedVersion` 重送；`'server'`：重新 `list` 取伺服器版本覆蓋本機並清除草稿。
- 卸載時若仍有排程中的上傳，立即送出（`beforeunload` 也送出）。

- [ ] **Step 1: 寫失敗測試**（`vi.useFakeTimers()`、`vi.mock('@/api/scoreSheets')`、`renderHook`）

```ts
it('debounces uploads to 1000ms')                     // 連續 3 次 update → 999ms 時 save 未呼叫；1000ms 時呼叫 1 次，content 為最後狀態
it('writes draft to localStorage immediately')        // update 後 localStorage 有 dirty:true
it('prefers newer local draft over server on load')   // 預置 dirty 草稿 → content 等於草稿，且自動上傳
it('goes offline on network error and retries')       // save 第一次 reject(network) → status 'offline'；5000ms 後重試成功 → 'saved'
it('conflict stops retrying')                          // save reject 409 → status 'conflict'，再過 10s save 呼叫次數不變
it('overwrite after conflict resends with server version') // 409 帶 version 4 → resolveConflict('mine') → save 以 expectedVersion 4 呼叫
it('use server after conflict replaces content and clears draft')
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- useSheetSync`
Expected: FAIL

- [ ] **Step 3: 實作 `scoreSheets.ts` 與 `useSheetSync.ts`**

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- useSheetSync`
Expected: PASS

- [ ] **Step 5: Commit** — `feat(client): 記錄單 API 與離線暫存同步`

---

### Task 5: 單局記錄單頁面

**Files:**
- Create: `src/components/scoresheet/useLongPress.ts`、`StatGrid.tsx`、`RallyStrip.tsx`、`LineupGrid.tsx`、`RotateHint.tsx`
- Create: `src/pages/MatchScoreSheet.tsx`
- Modify: `src/App.tsx`（在 `requirePage={PAGE.MatchLogs}` 區塊內加 `/match-logs/:eventId/games/:matchLogId/sheets/:setIndex`）
- Test: `src/components/scoresheet/StatGrid.test.tsx`、`RallyStrip.test.tsx`、`src/pages/MatchScoreSheet.test.tsx`

**Interfaces:**
- Consumes: Task 3 全部、Task 4 `useSheetSync`、`scoreSheetsApi.list`
- Produces（Task 6 會重用）：
  - `useLongPress(opts: { onClick(): void; onLongPress(): void; ms?: number /* 預設 500 */ }): PointerEventHandlers`
  - `<StatGrid rows={SheetRow[]} oppErrors ourErrors readOnly?={boolean} onBump?(playerId, key, delta) onBumpErrors?(side, delta) onRemoveRow?(playerId) />`
  - `<RallyStrip rally={RallyItem[]} />`（橫向捲動，新增項目時自動捲到最右）
  - `<LineupGrid lineup rows onChange(slot, playerId|null) />` — 2×3：上排 slot 索引 3,2,1（4、3、2 號位），下排 4,5,0（5、6、1 號位）

頁面要點（照 spec 版面圖）：
- 頁首：`VS 對手`、`第 N 局`、`scoreOf(rally)` 大字、記錄人（Input，預設 `displayName ?? userName`，僅在新局首次載入時帶入）、同步狀態（saved「已同步」／pending,saving「同步中」／offline「離線，稍後重送」／conflict）、`[站位]`（手機寬度以 Dialog 開 `LineupGrid`；`lg:` 以上直接顯示於頁首右側）、`[＋隊員]`（Dialog 列出 `roster` 中尚未加入者）。
- 中段 `StatGrid`；格子點擊 +1、長按 −1；每格 `min-h-11 min-w-11`；`StatGrid` 下方「撤銷表格」按鈕。
- 底部固定：`RallyStrip`＋`[我方 +1] [對方 +1] [我方暫停] [對方暫停] [撤銷比分]`。
- 表格撤銷：頁面內 `useRef<SheetContent[]>` 堆疊，只記錄 `bumpStat`/`bumpErrors` 前的狀態（上限 200）；比分撤銷＝`popRally`。
- 衝突時顯示 Dialog：「伺服器上有較新的版本（{updatedByName}）」，按鈕「用我的覆蓋」「改用伺服器版本」。
- `RotateHint`：`matchMedia('(orientation: portrait)')` 為真時全螢幕覆蓋「請將裝置轉為橫向」。
- Wake lock：`navigator.wakeLock?.request('screen')`，`visibilitychange` 回到前景時重新取得，卸載時釋放；不支援就略過。
- `setIndex` 不存在且不是「目前最大＋1」時導回列表頁。

- [ ] **Step 1: 寫失敗測試**

```tsx
// StatGrid.test.tsx
it('renders group headers and sub labels in paper order')  // 依序出現 發球…犯規；子標題 O X O no out …
it('tap increments a cell')                                 // pointerDown+pointerUp 於 小美/serveO → onBump(7,'serveO',1)
it('long press decrements once and does not also increment') // pointerDown，advance 500ms，pointerUp → 只有 onBump(7,'serveO',-1)
it('readOnly renders no handlers')

// RallyStrip.test.tsx
it('renders staggered rows and timeout marker')            // ['U','O','TU'] → 我方列 '1'、對方列 '1'、一個 Ⓣ 標記

// MatchScoreSheet.test.tsx（mock scoreSheetsApi、authStore）
it('our +1 updates header score and strip')               // 點「我方 +1」兩次、「對方 +1」一次 → 頁首 2 : 1
it('undo score removes last rally item')
it('undo table reverts last stat bump')
it('add player dialog lists only roster players not yet added')
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- scoresheet MatchScoreSheet`
Expected: FAIL

- [ ] **Step 3: 實作元件與頁面**

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- scoresheet MatchScoreSheet`
Expected: PASS

- [ ] **Step 5: Commit** — `feat(client): 單局比賽記錄單填寫頁`

---

### Task 6: 記錄單列表、整場合計與入口

**Files:**
- Create: `src/pages/MatchScoreSheets.tsx`
- Modify: `src/App.tsx`（加 `/match-logs/:eventId/games/:matchLogId/sheets`）
- Modify: `src/pages/MatchLogs.tsx`（`MatchScoreCard` 底部加按鈕，需把 `eventId` 傳入）
- Test: `src/pages/MatchScoreSheets.test.tsx`、修改 `MatchLogs` 既有測試（若有）

**Interfaces:**
- Consumes: Task 3 `sumSheets`、`normalizeContent`、`scoreOf`；Task 4 `scoreSheetsApi`；Task 5 `StatGrid`（`readOnly`）

要點：
- 入口按鈕：文字 `記錄單` 或 `記錄單 · {sheetCount} 局`，`navigate(\`/match-logs/${eventId}/games/${item.id}/sheets\`)`；點擊需 `stopPropagation`，不觸發卡片其他行為。
- 列表頁：標題 `VS {opponent}` 與日期；各局卡片（第 N 局、`scoreOf` 比分、記錄人、更新時間），點擊進入該局；最後一局卡片有刪除（`swal` 確認，文字「刪除第 N 局記錄單？已回填的局分不會改變。」）；`[新增第 N+1 局]` 以 `AddFab` 呈現（專案慣例）。
- 整場合計：`<StatGrid readOnly rows={sumSheets(...).rows} …>`，上方顯示各局比分列。沒有任何記錄單時顯示 `EmptyState`。
- 版面：`xl:grid xl:grid-cols-[2fr_3fr] xl:gap-6 xl:items-start`（左：各局；右：合計），以下垂直堆疊。

- [ ] **Step 1: 寫失敗測試**

```tsx
it('lists sets with score and recorder')            // 兩局 → 「第 1 局」「第 2 局」與比分 25 : 20
it('only last set offers delete')
it('add fab navigates to next set index')           // 已有 2 局 → 導向 .../sheets/3
it('totals sum per player across sets')             // 7 號兩局 serveO 1+2 → 合計格顯示 3
it('empty state when no sheets')
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- MatchScoreSheets`
Expected: FAIL

- [ ] **Step 3: 實作頁面、路由與入口按鈕**

- [ ] **Step 4: 全套驗證**

Run（client 目錄）：`npm test && npx tsc -b && npm run lint`
Run（根目錄）：`dotnet build && dotnet test VolleyballTrainingTracker.Server.Tests`
Expected: 全部通過、無型別或 lint 錯誤

- [ ] **Step 5: 手動走一遍（iPad 橫放尺寸 1180×820、手機橫放 844×390）**

開一場友誼賽 → 記錄單 → 新增第 1 局 → 加 3 位隊員、排站位、點幾格、長按一格、記 5 分含一次暫停 → 關閉網路點幾下 → 恢復網路確認同步 → 回列表看合計 → 回比賽紀錄確認局分已回填。
Expected: 每步行為符合 spec

- [ ] **Step 6: Commit** — `feat(client): 記錄單列表、整場合計與比賽紀錄入口`
