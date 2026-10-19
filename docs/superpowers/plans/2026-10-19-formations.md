# 防守站位／接發站位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「防守站位」「接發站位」兩個頁面，站位以位置格子存於 DB（全隊共用），切換影格時球員以動畫移動，可帶入賽事陣容顯示球員。

**Architecture:** 後端新增 `"Formations"` 表（一套 = 一筆 jsonb 文件，固定三個 Key），`FormationsController` 提供 GET/PUT，以 `Version` 欄位做樂觀並行控制。前端把站位邏輯（輪轉、位置錯誤、解析、編輯操作、陣容預填）做成 `src/lib/formations/` 的純函式並單元測試；頁面以 `useFormation` hook 管理載入／草稿／儲存／衝突，以新的半場元件 `FormationCourt` 呈現。

**Tech Stack:** ASP.NET Core 8、EF Core 8 + Npgsql（PostgreSQL 17）、xUnit；React 19 + Vite + TS、@tanstack/react-query、Tailwind、vitest + Testing Library。

**Spec:** `docs/superpowers/specs/2026-10-19-formations-design.md`

## Global Constraints

- 一律繁體中文（UI 文字、註解、commit 訊息）。
- 頁面名稱：「防守站位」（`/defense`，頁面 `defense`）、「接發站位」（`/receive`，頁面 `receive`）。
- 編輯權限字串：`formations.edit`；預設授予 Admin、Coach、Captain、ViceCaptain。
- Formation Key 只有三個：`defense`、`receive-opp`（顯示「舉對＋自由＋1大砲」）、`receive-2oh`（顯示「2大砲＋自由」）。
- R1 的 1–6 號位：1=OH2、2=MB1、3=S、4=OH1、5=MB2、6=OPP；順時針輪轉（Rn 的 p 號位 = R1 的 ((p−1+n−1) mod 6)+1 號位）。
- Layout 必須含 `"version": 1`；伺服器端上限 64KB。
- 座標正規化：x ∈ [0,1] 左邊線→右邊線；y ∈ [0,1] 球網→端線後 2m（共 11m）。
- 情況名稱 1–20 字（trim 後）。
- SQL 識別字一律 PascalCase 加雙引號；增量腳本可重複執行；同步更新 `pg_init.sql` 與 EF 實體。
- `DateTime` 以 UTC 寫入；稽核欄位由 `AppDbContext.SaveChangesAsync` 自動填，不手動指派。
- 響應式：`xl:` 以上並排（`xl:grid xl:grid-cols-[2fr_3fr] xl:gap-6 xl:items-start`），以下垂直堆疊。
- 交付前必跑：`npm run lint`、`npm test`、`npm run build`（client 目錄）、`dotnet build`、`dotnet test`（Tests 專案）。
- 不使用 vexp 工具。

## Review Focus

1. 編輯中刪除「目前正在檢視」的情況 → 畫面應回到「基本站位」而非崩潰或空白（Task 11 測試）。
2. 從未儲存過（API 回 `layout: null`）→ 顯示內建預設且**不可**出現「站位資料格式異常」提示（Task 8、Task 11 測試）。
3. 賽事陣容某位置人數不足、或球員沒有登錄位置 → 該格退回顯示位置代號，不得把錯位置的人塞進去（Task 7 測試）。
4. 情況名稱空白、全空白或超過 20 字 → 新增／改名被拒絕且原資料不變（Task 7 測試）。
5. 拖曳到場地外或指標座標異常（NaN）→ 座標夾回 [0,1]，不得產生 NaN 寫進 DB（Task 4 測試）。

---

### Task 1: 後端權限與頁面常數、角色 seed

**Files:**
- Modify: `VolleyballTrainingTracker.Server/Auth/Permissions.cs`
- Modify: `VolleyballTrainingTracker.Server/Program.cs`（`SeedRolesAsync`，約 293–330 行）
- Test: `VolleyballTrainingTracker.Server.Tests/Auth/PermissionsTests.cs`

**Interfaces:**
- Produces: `Permissions.FormationsEdit = "formations.edit"`、`Pages.Defense = "defense"`、`Pages.Receive = "receive"`（Task 3 使用）

- [ ] **Step 1: 寫失敗測試**

在 `PermissionsTests.cs` 的 `Permissions_All_ContainsEveryConstant` 結尾加：

```csharp
        Assert.Contains(Permissions.FormationsEdit, Permissions.All);
```

在 `Pages_All_ContainsEveryConstant` 結尾加：

```csharp
        Assert.Contains(Pages.Defense, Pages.All);
        Assert.Contains(Pages.Receive, Pages.All);
```

- [ ] **Step 2: 確認測試失敗**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false`
Expected: 編譯失敗，`Permissions` 不含 `FormationsEdit` 定義。

- [ ] **Step 3: 實作常數**

`Permissions.cs` 的 `SponsorsEdit` 之後加：

```csharp
    // 防守站位／接發站位：看由 Pages.Defense / Pages.Receive 控管；
    // 此權限授予修改並儲存「全隊共用站位」的能力（預設：管理員／教練／隊長／副隊長）。
    public const string FormationsEdit = "formations.edit";
```

`Permissions.All` 改為：

```csharp
    public static readonly string[] All =
    {
        PlayersEdit, PlayersPurge,
        SessionsEdit, DrillsEdit, MatchLogsEdit,
        UsersManage, RolesManage,
        BoardManage,
        SponsorsEdit,
        FormationsEdit,
    };
```

`Pages` 類別在 `Tactics` 之後加：

```csharp
    // 防守站位／接發站位：全隊共用的站位體系（存 DB），看與編分離（編輯需 formations.edit）。
    public const string Defense = "defense";
    public const string Receive = "receive";
```

`Pages.All` 改為：

```csharp
    public static readonly string[] All =
    {
        Dashboard, Calendar, Players, Sessions, MatchLogs, Tactics, Defense, Receive, Drills, Crying, Board, Sponsors, AdminRoles, AdminUsers, Profile,
    };
```

- [ ] **Step 4: 更新 seed**

`Program.cs` 的 `SeedRolesAsync` 中：

```csharp
    var coachPerms = JsonSerializer.Serialize(new[]
    {
        Permissions.PlayersEdit,
        Permissions.SessionsEdit,
        Permissions.DrillsEdit,
        Permissions.SponsorsEdit,
        Permissions.FormationsEdit,
    });
    var coachPages = JsonSerializer.Serialize(new[]
    {
        Pages.Dashboard, Pages.Calendar, Pages.Players, Pages.Sessions, Pages.Tactics, Pages.Defense, Pages.Receive, Pages.Drills, Pages.Board, Pages.Sponsors, Pages.Profile,
    });
    var playerPerms = JsonSerializer.Serialize(Array.Empty<string>());
    var playerPages = coachPages; // 跟 Coach 同步主功能可看
    // 隊長／副隊長：頁面同選手，但可編輯全隊站位（防守／接發）
    var captainPerms = JsonSerializer.Serialize(new[] { Permissions.FormationsEdit });
    var captainPages = playerPages;
```

- [ ] **Step 5: 確認測試通過**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add VolleyballTrainingTracker.Server/Auth/Permissions.cs VolleyballTrainingTracker.Server/Program.cs VolleyballTrainingTracker.Server.Tests/Auth/PermissionsTests.cs
git commit -m "新增站位頁面與 formations.edit 權限常數、角色 seed"
```

---

### Task 2: 後端資料表 Formations（實體、DbContext、SQL）

**Files:**
- Create: `VolleyballTrainingTracker.Server/Entities/Formation.cs`
- Modify: `VolleyballTrainingTracker.Server/Data/AppDbContext.cs`
- Create: `VolleyballTrainingTracker.Server/Data/Sql/2026-10-19_AddFormations.sql`
- Modify: `VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql`

**Interfaces:**
- Produces: `Formation`（`Id`、`Key`、`Layout`(string, jsonb)、`Version`(int, concurrency token)、稽核欄位、`CreatedByUser`、`UpdatedByUser`）、`AppDbContext.Formations`

- [ ] **Step 1: 建立實體**

`Entities/Formation.cs`：

```csharp
namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 全隊共用站位（防守／接發）：一套站位存成一筆，內容為 jsonb 文件。
/// Key 固定為 defense / receive-opp / receive-2oh；Layout 結構由前端解析器負責。
/// Version 每次儲存 +1，作為樂觀並行控制（避免兩人同時編輯互相覆蓋）。
/// </summary>
public class Formation
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Layout { get; set; } = "{}";
    public int Version { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
}
```

- [ ] **Step 2: DbContext 設定**

`AppDbContext.cs`：`Sponsorships` DbSet 之後加 `public DbSet<Formation> Formations => Set<Formation>();`

`OnModelCreating` 結尾（`Sponsorship` 設定之後）加：

```csharp
        modelBuilder.Entity<Formation>(e =>
        {
            e.ToTable("Formations", t =>
            {
                t.HasCheckConstraint("CK_Formations_Key", "\"Key\" IN ('defense','receive-opp','receive-2oh')");
            });
            e.Property(x => x.Key).HasMaxLength(30).IsRequired();
            e.Property(x => x.Layout).HasColumnType("jsonb").IsRequired();
            // UPDATE 時帶 WHERE "Version" = 原值，同時儲存的第二人會得到 DbUpdateConcurrencyException
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasIndex(x => x.Key).IsUnique().HasDatabaseName("UX_Formations_Key");
            e.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });
```

- [ ] **Step 3: 增量 SQL 腳本**

`Data/Sql/2026-10-19_AddFormations.sql`：

```sql
-- ============================================================================
-- PostgreSQL 17 — 新增「防守站位／接發站位」（Formations 表、頁面與編輯權限）
-- ----------------------------------------------------------------------------
-- 背景：全隊共用站位存 DB，一套一筆（Key 固定三值），Layout 為 jsonb 文件，
--       Version 供樂觀並行控制。seed-roles 只影響新建角色，既有 DB 需執行本腳本。
-- 規則：
--   1) 建立 "Formations" 表、唯一索引、外鍵。
--   2) 已能看到 tactics 的角色，補上 defense、receive 頁面。
--   3) Admin / Coach / Captain / ViceCaptain 補上 formations.edit。
-- 冪等：IF NOT EXISTS 建表／索引／外鍵；已含頁面或權限的角色不重複加入。
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "Formations" (
    "Id"              integer       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "Key"             varchar(30)   NOT NULL,
    "Layout"          jsonb         NOT NULL,
    "Version"         integer       NOT NULL DEFAULT 1,
    "CreatedAt"       timestamptz   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "UpdatedAt"       timestamptz   NULL,
    "CreatedByUserId" integer       NULL,
    "UpdatedByUserId" integer       NULL,
    CONSTRAINT "CK_Formations_Key" CHECK ("Key" IN ('defense','receive-opp','receive-2oh'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "UX_Formations_Key" ON "Formations"("Key");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Formations_CreatedBy') THEN
        ALTER TABLE "Formations" ADD CONSTRAINT "FK_Formations_CreatedBy"
            FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Formations_UpdatedBy') THEN
        ALTER TABLE "Formations" ADD CONSTRAINT "FK_Formations_UpdatedBy"
            FOREIGN KEY ("UpdatedByUserId") REFERENCES "Users"("Id");
    END IF;
END $$;

-- 2) 頁面：已有 tactics 的角色補上 defense、receive（各自判斷，可重複執行）
UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"tactics"', '"tactics","defense"')
WHERE "AllowedPages" LIKE '%"tactics"%'
  AND "AllowedPages" NOT LIKE '%"defense"%';

UPDATE "Roles"
SET "AllowedPages" = replace("AllowedPages", '"tactics"', '"tactics","receive"')
WHERE "AllowedPages" LIKE '%"tactics"%'
  AND "AllowedPages" NOT LIKE '%"receive"%';

-- 3) 編輯權限
UPDATE "Roles"
SET "Permissions" = CASE
        WHEN "Permissions" LIKE '[]' OR "Permissions" IS NULL OR btrim("Permissions") = ''
            THEN '["formations.edit"]'
        ELSE replace("Permissions", ']', ',"formations.edit"]')
    END
WHERE "Name" IN ('Admin', 'Coach', 'Captain', 'ViceCaptain')
  AND ("Permissions" IS NULL OR "Permissions" NOT LIKE '%"formations.edit"%');

COMMIT;
```

- [ ] **Step 4: 同步 pg_init.sql**

1. 在 `Sponsorships` 的 `CREATE TABLE` 之後、`-- 外鍵（全部資料表建立後再加…` 區塊標題之前插入：

```sql
-- ---------- Formations (全隊共用站位：防守／接發；一套一筆 jsonb，Version 供樂觀並行控制) ----------
CREATE TABLE IF NOT EXISTS "Formations" (
    "Id"              integer       GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "Key"             varchar(30)   NOT NULL,
    "Layout"          jsonb         NOT NULL,
    "Version"         integer       NOT NULL DEFAULT 1,
    "CreatedAt"       timestamptz   NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "UpdatedAt"       timestamptz   NULL,
    "CreatedByUserId" integer       NULL,
    "UpdatedByUserId" integer       NULL,
    CONSTRAINT "CK_Formations_Key" CHECK ("Key" IN ('defense','receive-opp','receive-2oh'))
);

```

2. 外鍵 `DO $$` 區塊中，`FK_Sponsorships_UpdatedBy` 的 `END IF;` 之後、`END $$;` 之前插入：

```sql

    -- Formations
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Formations_CreatedBy') THEN
        ALTER TABLE "Formations" ADD CONSTRAINT "FK_Formations_CreatedBy"
            FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Formations_UpdatedBy') THEN
        ALTER TABLE "Formations" ADD CONSTRAINT "FK_Formations_UpdatedBy"
            FOREIGN KEY ("UpdatedByUserId") REFERENCES "Users"("Id");
    END IF;
```

3. 索引區 `IX_Sponsorships_OccurredAt` 那行之後加：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Formations_Key"         ON "Formations"("Key");
```

- [ ] **Step 5: 編譯**

Run: `dotnet build VolleyballTrainingTracker.Server/VolleyballTrainingTracker.Server.csproj -p:BuildClient=false`
Expected: Build succeeded，0 錯誤。

- [ ] **Step 6:（可選，本機有 PG17 時）套用腳本兩次確認冪等**

Run（本機 PG17 在 5433；資料庫名稱、帳號依 `appsettings.Development.json`）：
`psql -h localhost -p 5433 -U <user> -d <db> -f VolleyballTrainingTracker.Server/Data/Sql/2026-10-19_AddFormations.sql`，再執行一次。
Expected: 兩次皆無錯誤；`SELECT "Name","AllowedPages","Permissions" FROM "Roles";` 中 Coach/Captain/ViceCaptain 各只出現一次 `formations.edit`。若本機無 psql，於交付說明註明「待手動驗證」。

- [ ] **Step 7: Commit**

```bash
git add VolleyballTrainingTracker.Server/Entities/Formation.cs VolleyballTrainingTracker.Server/Data/AppDbContext.cs VolleyballTrainingTracker.Server/Data/Sql/2026-10-19_AddFormations.sql VolleyballTrainingTracker.Server/Data/Sql/pg_init.sql
git commit -m "新增 Formations 資料表（實體、DbContext、增量與合併 DDL）"
```

---

### Task 3: 後端規則、DTO、FormationsController

**Files:**
- Create: `VolleyballTrainingTracker.Server/Formations/FormationRules.cs`
- Create: `VolleyballTrainingTracker.Server/Dtos/FormationDtos.cs`
- Create: `VolleyballTrainingTracker.Server/Controllers/FormationsController.cs`
- Test: `VolleyballTrainingTracker.Server.Tests/Formations/FormationRulesTests.cs`

**Interfaces:**
- Consumes: Task 1 常數、Task 2 `Formation`／`AppDbContext.Formations`
- Produces（HTTP，Task 8 前端使用）：
  - `GET /api/formations/{key}` → `{ key, layout: object|null, version: number, updatedAt: string|null, updatedByName: string|null }`
  - `PUT /api/formations/{key}` body `{ layout: object, expectedVersion: number }` → 同上；409 body `{ message, version, updatedAt, updatedByName }`；400 `{ message }`；403；404

- [ ] **Step 1: 寫失敗測試**

`VolleyballTrainingTracker.Server.Tests/Formations/FormationRulesTests.cs`：

```csharp
using System.Text.Json;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Formations;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.Formations;

public class FormationRulesTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement.Clone();

    [Theory]
    [InlineData("defense", Pages.Defense)]
    [InlineData("receive-opp", Pages.Receive)]
    [InlineData("receive-2oh", Pages.Receive)]
    public void PageForKey_KnownKeys(string key, string page)
    {
        Assert.Equal(page, FormationRules.PageForKey(key));
    }

    [Theory]
    [InlineData("offense")]
    [InlineData("Defense")]
    [InlineData("")]
    public void PageForKey_UnknownKey_ReturnsNull(string key)
    {
        Assert.Null(FormationRules.PageForKey(key));
    }

    [Fact]
    public void ValidateLayout_ObjectWithVersion1_IsValid()
    {
        Assert.Null(FormationRules.ValidateLayout(Json("{\"version\":1,\"bases\":{}}")));
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("\"text\"")]
    [InlineData("{}")]
    [InlineData("{\"version\":2}")]
    [InlineData("{\"version\":\"1\"}")]
    [InlineData("{\"version\":1.5}")]
    public void ValidateLayout_Invalid_ReturnsError(string json)
    {
        Assert.NotNull(FormationRules.ValidateLayout(Json(json)));
    }

    [Fact]
    public void ValidateLayout_Undefined_ReturnsError()
    {
        Assert.NotNull(FormationRules.ValidateLayout(default));
    }

    [Fact]
    public void ValidateLayout_TooLarge_ReturnsError()
    {
        var big = new string('a', FormationRules.MaxLayoutBytes);
        Assert.NotNull(FormationRules.ValidateLayout(Json($"{{\"version\":1,\"pad\":\"{big}\"}}")));
    }
}
```

- [ ] **Step 2: 確認失敗**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false`
Expected: 編譯失敗，找不到 `FormationRules`。

- [ ] **Step 3: 實作 FormationRules**

`Formations/FormationRules.cs`：

```csharp
using System.Text;
using System.Text.Json;
using VolleyballTrainingTracker.Server.Auth;

namespace VolleyballTrainingTracker.Server.Formations;

/// <summary>
/// 站位（Formations）的純規則：Key 白名單與對應頁面權限、Layout 基本驗證。
/// 細部結構（格子代碼、座標範圍）由前端解析器負責，伺服器只守住「是物件、不過大、版本正確」。
/// </summary>
public static class FormationRules
{
    public const int MaxLayoutBytes = 64 * 1024;

    private static readonly IReadOnlyDictionary<string, string> KeyToPage = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["defense"] = Pages.Defense,
        ["receive-opp"] = Pages.Receive,
        ["receive-2oh"] = Pages.Receive,
    };

    /// <summary>Key 對應的頁面權限；非白名單回 null。</summary>
    public static string? PageForKey(string key) =>
        KeyToPage.TryGetValue(key, out var page) ? page : null;

    /// <summary>驗證 Layout；合法回 null，否則回錯誤訊息。</summary>
    public static string? ValidateLayout(JsonElement layout)
    {
        if (layout.ValueKind != JsonValueKind.Object) return "站位資料格式錯誤";
        if (Encoding.UTF8.GetByteCount(layout.GetRawText()) > MaxLayoutBytes) return "站位資料過大";
        if (!layout.TryGetProperty("version", out var v)
            || v.ValueKind != JsonValueKind.Number
            || !v.TryGetInt32(out var n)
            || n != 1)
        {
            return "站位資料版本不支援";
        }
        return null;
    }
}
```

- [ ] **Step 4: 確認測試通過**

Run: `dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false`
Expected: 全部 PASS。

- [ ] **Step 5: DTO**

`Dtos/FormationDtos.cs`：

```csharp
using System.Text.Json;

namespace VolleyballTrainingTracker.Server.Dtos;

public class FormationDto
{
    public string Key { get; set; } = string.Empty;
    /// <summary>尚未儲存過為 null（前端改用內建預設）。</summary>
    public JsonElement? Layout { get; set; }
    /// <summary>尚未儲存過為 0。</summary>
    public int Version { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class FormationSaveRequest
{
    public JsonElement Layout { get; set; }
    /// <summary>前端載入時的版本；首次新增為 0。</summary>
    public int ExpectedVersion { get; set; }
}
```

- [ ] **Step 6: Controller**

`Controllers/FormationsController.cs`：

```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;
using VolleyballTrainingTracker.Server.Formations;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 全隊共用站位（防守／接發）。
/// 讀取：依 key 對應的頁面權限（defense → Pages.Defense；receive-* → Pages.Receive），
///       因頁面隨 key 而異，無法用單一 [RequirePage]，改在動作內檢查 page claim。
/// 儲存：另需 [RequirePermission(Permissions.FormationsEdit)]；以 Version 做樂觀並行控制，
///       版本不符或同時儲存回 409，避免兩人同時編輯互相覆蓋。
/// 無刪除 API（三套 Key 固定）。
/// </summary>
[ApiController]
[Authorize]
[Route("api/formations")]
public class FormationsController : ControllerBase
{
    private readonly AppDbContext _db;
    public FormationsController(AppDbContext db) => _db = db;

    [HttpGet("{key}")]
    public async Task<ActionResult<FormationDto>> Get(string key)
    {
        var denied = CheckKeyAndPage(key);
        if (denied != null) return denied;
        return Ok(await LoadDtoAsync(key));
    }

    [HttpPut("{key}")]
    [RequirePermission(Permissions.FormationsEdit)]
    public async Task<ActionResult<FormationDto>> Save(string key, [FromBody] FormationSaveRequest req)
    {
        var denied = CheckKeyAndPage(key);
        if (denied != null) return denied;

        var err = FormationRules.ValidateLayout(req.Layout);
        if (err != null) return BadRequest(new { message = err });

        var layoutJson = req.Layout.GetRawText();
        var entity = await _db.Formations.FirstOrDefaultAsync(f => f.Key == key);
        var currentVersion = entity?.Version ?? 0;
        if (req.ExpectedVersion != currentVersion) return await ConflictAsync(key);

        if (entity == null)
        {
            _db.Formations.Add(new Formation { Key = key, Layout = layoutJson, Version = 1 });
        }
        else
        {
            entity.Layout = layoutJson;
            entity.Version = currentVersion + 1;
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // 檢查版本後、寫入前被他人搶先更新（UPDATE 的 WHERE "Version" 不符）
            _db.ChangeTracker.Clear();
            return await ConflictAsync(key);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // 兩人同時首次新增：第二筆撞 UX_Formations_Key
            _db.ChangeTracker.Clear();
            return await ConflictAsync(key);
        }

        return Ok(await LoadDtoAsync(key));
    }

    private ActionResult? CheckKeyAndPage(string key)
    {
        var page = FormationRules.PageForKey(key);
        if (page == null) return NotFound(new { message = "找不到此站位" });
        if (!User.FindAll(JwtClaimTypes.Page).Any(c => c.Value == page))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = $"無此頁面權限：{page}" });
        }
        return null;
    }

    private async Task<FormationDto> LoadDtoAsync(string key)
    {
        var row = await _db.Formations.AsNoTracking()
            .Where(f => f.Key == key)
            .Select(f => new
            {
                f.Layout,
                f.Version,
                f.CreatedAt,
                f.UpdatedAt,
                UpdatedByName = f.UpdatedByUser != null
                    ? (f.UpdatedByUser.DisplayName ?? f.UpdatedByUser.UserName)
                    : null,
                CreatedByName = f.CreatedByUser != null
                    ? (f.CreatedByUser.DisplayName ?? f.CreatedByUser.UserName)
                    : null,
            })
            .FirstOrDefaultAsync();

        if (row == null) return new FormationDto { Key = key, Layout = null, Version = 0 };

        using var doc = JsonDocument.Parse(row.Layout);
        return new FormationDto
        {
            Key = key,
            Layout = doc.RootElement.Clone(),
            Version = row.Version,
            // 只新增過、未曾修改時以建立資訊代替
            UpdatedAt = row.UpdatedAt ?? row.CreatedAt,
            UpdatedByName = row.UpdatedByName ?? row.CreatedByName,
        };
    }

    private async Task<ObjectResult> ConflictAsync(string key)
    {
        var cur = await LoadDtoAsync(key);
        return Conflict(new
        {
            message = "站位已被他人更新，請重新載入",
            version = cur.Version,
            updatedAt = cur.UpdatedAt,
            updatedByName = cur.UpdatedByName,
        });
    }
}
```

- [ ] **Step 7: 編譯＋測試**

Run: `dotnet build VolleyballTrainingTracker.Server/VolleyballTrainingTracker.Server.csproj -p:BuildClient=false` 然後 `dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false`
Expected: 0 錯誤，全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add VolleyballTrainingTracker.Server/Formations VolleyballTrainingTracker.Server/Dtos/FormationDtos.cs VolleyballTrainingTracker.Server/Controllers/FormationsController.cs VolleyballTrainingTracker.Server.Tests/Formations
git commit -m "新增站位 API（GET/PUT、版本號衝突處理）與規則單元測試"
```

---

### Task 4: 前端權限常數、半場幾何、輪轉計算

**Files:**
- Modify: `volleyballtrainingtracker.client/src/stores/authStore.ts`（`PERM`、`PAGE`）
- Create: `volleyballtrainingtracker.client/src/lib/formations/geometry.ts`
- Create: `volleyballtrainingtracker.client/src/lib/formations/rotation.ts`
- Create: `volleyballtrainingtracker.client/src/lib/formations/slots.ts`
- Test: `volleyballtrainingtracker.client/src/lib/formations/geometry.test.ts`
- Test: `volleyballtrainingtracker.client/src/lib/formations/rotation.test.ts`

**Interfaces:**
- Produces:
  - `PERM.FormationsEdit`、`PAGE.Defense`、`PAGE.Receive`
  - geometry：`interface Point {x;y}`、`HALF_VIEW`、`HALF_PAD`、`HALF_COURT_W`、`HALF_DEPTH`、`END_LINE_Y`、`ATTACK_LINE_Y`、`toView(p)`、`toPercent(p): {left; top}`、`fromContainerFraction(fx, fy): Point`、`clampPoint(p): Point`
  - rotation：`type CourtPos`、`type RotationNo`、`type ReceiveSlot = "S"|"OPP"|"OH1"|"OH2"|"MB1"|"MB2"|"L"`、`ROTATIONS`、`COURT_POSITIONS`、`R1_ORDER`、`isFrontRow(pos)`、`rotationLineup(r): Record<CourtPos, ReceiveSlot>`、`setterPosition(r)`、`isSetterFrontRow(r)`、`liberoReplaces(r): "MB1"|"MB2"`、`onCourtSlots(r): ReceiveSlot[]`、`rotationLabel(r)`
  - slots：`type DefenseSlot = "S"|"OPP"|"OHF"|"OHB"|"MB"|"L"`、`DEFENSE_SLOTS`、`RECEIVE_SLOTS`、`interface SlotMeta {label; position: PositionCode}`、`DEFENSE_SLOT_META`、`RECEIVE_SLOT_META`

- [ ] **Step 1: authStore 常數**

`PERM` 結尾加 `FormationsEdit: 'formations.edit',`；`PAGE` 在 `Tactics` 後加：

```ts
  Defense: 'defense',
  Receive: 'receive',
```

- [ ] **Step 2: 寫失敗測試**

`src/lib/formations/geometry.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { clampPoint, fromContainerFraction, toPercent } from "./geometry";

describe("formations geometry", () => {
  it("左上角（網前左邊線）對應容器內的緩衝區偏移", () => {
    const p = toPercent({ x: 0, y: 0 });
    expect(p.left).toBeCloseTo(5);
    expect(p.top).toBeCloseTo((50 / 1150) * 100);
  });

  it("容器位置可來回換算", () => {
    const { left, top } = toPercent({ x: 0.3, y: 0.6 });
    const back = fromContainerFraction(left / 100, top / 100);
    expect(back.x).toBeCloseTo(0.3);
    expect(back.y).toBeCloseTo(0.6);
  });

  it("拖到場外時夾回 [0,1]", () => {
    expect(fromContainerFraction(-1, 2)).toEqual({ x: 0, y: 1 });
  });

  it("NaN／Infinity 座標夾成 0，不得產生 NaN", () => {
    expect(clampPoint({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: 0, y: 0 });
  });
});
```

`src/lib/formations/rotation.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  isSetterFrontRow,
  liberoReplaces,
  onCourtSlots,
  rotationLabel,
  rotationLineup,
  setterPosition,
  ROTATIONS,
} from "./rotation";

describe("rotation", () => {
  it("R1 依球隊排法：1=OH2 2=MB1 3=S 4=OH1 5=自由(替 MB2) 6=OPP", () => {
    expect(rotationLineup(1)).toEqual({ 1: "OH2", 2: "MB1", 3: "S", 4: "OH1", 5: "L", 6: "OPP" });
  });

  it("R2 順時針輪轉一格：攔中1 輪到 1 號位（後排）由自由替換", () => {
    expect(rotationLineup(2)).toEqual({ 1: "L", 2: "S", 3: "OH1", 4: "MB2", 5: "OPP", 6: "OH2" });
  });

  it("R3 後排攔中 MB1 由自由替換", () => {
    expect(rotationLineup(3)).toEqual({ 1: "S", 2: "OH1", 3: "MB2", 4: "OPP", 5: "OH2", 6: "L" });
  });

  it("舉球員號位依序為 3,2,1,6,5,4", () => {
    expect(ROTATIONS.map(setterPosition)).toEqual([3, 2, 1, 6, 5, 4]);
  });

  it("舉球員前排：R1、R2、R6", () => {
    expect(ROTATIONS.map(isSetterFrontRow)).toEqual([true, true, false, false, false, true]);
  });

  it("自由替換的攔中", () => {
    expect(ROTATIONS.map(liberoReplaces)).toEqual(["MB2", "MB1", "MB1", "MB1", "MB2", "MB2"]);
  });

  it("每輪轉場上 6 格且含自由、不含被替換的攔中", () => {
    for (const r of ROTATIONS) {
      const slots = onCourtSlots(r);
      expect(slots).toHaveLength(6);
      expect(slots).toContain("L");
      expect(slots).not.toContain(liberoReplaces(r));
    }
  });

  it("輪轉標籤", () => {
    expect(rotationLabel(1)).toBe("R1（舉球在3號位）");
    expect(rotationLabel(4)).toBe("R4（舉球在6號位）");
  });
});
```

- [ ] **Step 3: 確認失敗**

Run（client 目錄）：`npx vitest run src/lib/formations`
Expected: FAIL，模組不存在。

- [ ] **Step 4: 實作 geometry.ts**

```ts
// 防守／接發站位：我方半場座標系（與 lib/court.ts 的全場座標系互不相干）。
// 正規化座標：x ∈ [0,1] 對應左邊線→右邊線（9m）；y ∈ [0,1] 對應球網→端線後 2m（共 11m）。
// 「左」以站在我方端線後、面向球網看：左前為 4 號位（畫面上球網在上方）。

export interface Point {
  x: number;
  y: number;
}

/** viewBox（0.1m 單位）：寬 = 0.5 + 9 + 0.5 m；高 = 網前 0.5m + 11m */
export const HALF_VIEW = { w: 1000, h: 1150 } as const;
export const HALF_PAD = 50;
export const HALF_COURT_W = 900;
export const HALF_DEPTH = 1100;

/** 端線（離網 9m）的正規化 y */
export const END_LINE_Y = 900 / HALF_DEPTH;
/** 攻擊線（離網 3m）的正規化 y */
export const ATTACK_LINE_Y = 300 / HALF_DEPTH;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function clampPoint(p: Point): Point {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

/** 正規化座標 → viewBox 座標（SVG 繪圖用） */
export function toView(p: Point): Point {
  return { x: HALF_PAD + p.x * HALF_COURT_W, y: HALF_PAD + p.y * HALF_DEPTH };
}

/** 正規化座標 → 容器百分比（token 絕對定位用） */
export function toPercent(p: Point): { left: number; top: number } {
  const v = toView(p);
  return { left: (v.x / HALF_VIEW.w) * 100, top: (v.y / HALF_VIEW.h) * 100 };
}

/** 容器內相對位置（0~1，相對容器寬高）→ 正規化座標（已夾在範圍內） */
export function fromContainerFraction(fx: number, fy: number): Point {
  return clampPoint({
    x: (fx * HALF_VIEW.w - HALF_PAD) / HALF_COURT_W,
    y: (fy * HALF_VIEW.h - HALF_PAD) / HALF_DEPTH,
  });
}
```

- [ ] **Step 5: 實作 rotation.ts**

```ts
// 接發輪轉（5-1 體系）：R1 排法為球隊實際排法，見設計文件。
// 每得發球權順時針輪轉一格：Rn 的 p 號位 = R1 的 ((p−1+n−1) mod 6)+1 號位。

export type CourtPos = 1 | 2 | 3 | 4 | 5 | 6;
export type RotationNo = 1 | 2 | 3 | 4 | 5 | 6;
export type ReceiveSlot = "S" | "OPP" | "OH1" | "OH2" | "MB1" | "MB2" | "L";
type RawSlot = Exclude<ReceiveSlot, "L">;

export const ROTATIONS: readonly RotationNo[] = [1, 2, 3, 4, 5, 6];
export const COURT_POSITIONS: readonly CourtPos[] = [1, 2, 3, 4, 5, 6];

/** R1 的 1–6 號位 */
export const R1_ORDER: Readonly<Record<CourtPos, RawSlot>> = {
  1: "OH2",
  2: "MB1",
  3: "S",
  4: "OH1",
  5: "MB2",
  6: "OPP",
};

const FRONT_ROW: ReadonlySet<CourtPos> = new Set<CourtPos>([2, 3, 4]);
export const isFrontRow = (pos: CourtPos) => FRONT_ROW.has(pos);

function rawSlotAt(rotation: RotationNo, pos: CourtPos): RawSlot {
  const r1Pos = (((pos - 1 + (rotation - 1)) % 6) + 1) as CourtPos;
  return R1_ORDER[r1Pos];
}

/** 該輪轉場上 1–6 號位的格子；後排攔中由自由（L）替換 */
export function rotationLineup(rotation: RotationNo): Record<CourtPos, ReceiveSlot> {
  const out = {} as Record<CourtPos, ReceiveSlot>;
  for (const pos of COURT_POSITIONS) {
    const raw = rawSlotAt(rotation, pos);
    out[pos] = !isFrontRow(pos) && (raw === "MB1" || raw === "MB2") ? "L" : raw;
  }
  return out;
}

export function setterPosition(rotation: RotationNo): CourtPos {
  return COURT_POSITIONS.find((p) => rawSlotAt(rotation, p) === "S") as CourtPos;
}

export const isSetterFrontRow = (rotation: RotationNo) => isFrontRow(setterPosition(rotation));

/** 自由球員替換的攔中（在後排的那一位） */
export function liberoReplaces(rotation: RotationNo): "MB1" | "MB2" {
  const pos = COURT_POSITIONS.find((p) => {
    const raw = rawSlotAt(rotation, p);
    return !isFrontRow(p) && (raw === "MB1" || raw === "MB2");
  }) as CourtPos;
  return rawSlotAt(rotation, pos) as "MB1" | "MB2";
}

/** 該輪轉在場上的 6 格（依 1–6 號位順序） */
export function onCourtSlots(rotation: RotationNo): ReceiveSlot[] {
  const lineup = rotationLineup(rotation);
  return COURT_POSITIONS.map((p) => lineup[p]);
}

export const rotationLabel = (rotation: RotationNo) =>
  `R${rotation}（舉球在${setterPosition(rotation)}號位）`;
```

- [ ] **Step 6: 實作 slots.ts**

```ts
import type { PositionCode } from "@/lib/positions";
import type { ReceiveSlot } from "./rotation";

/** 防守格子：防守不分輪轉，主攻只分前排（OHF）／後排（OHB） */
export type DefenseSlot = "S" | "OPP" | "OHF" | "OHB" | "MB" | "L";

/** 陣容自動預填依此順序：同位置多人時，前面的格子先拿到背號小的球員 */
export const DEFENSE_SLOTS: readonly DefenseSlot[] = ["S", "OPP", "OHF", "OHB", "MB", "L"];
export const RECEIVE_SLOTS: readonly ReceiveSlot[] = ["S", "OPP", "OH1", "OH2", "MB1", "MB2", "L"];

export interface SlotMeta {
  /** 未帶入陣容時 token 上顯示的代號 */
  label: string;
  /** 對應的球員位置代碼（配色、自動預填用） */
  position: PositionCode;
}

export const DEFENSE_SLOT_META: Readonly<Record<DefenseSlot, SlotMeta>> = {
  S: { label: "舉球", position: "S" },
  OPP: { label: "副攻", position: "OPP" },
  OHF: { label: "主攻(前)", position: "OH" },
  OHB: { label: "主攻(後)", position: "OH" },
  MB: { label: "攔中", position: "MB" },
  L: { label: "自由", position: "L" },
};

export const RECEIVE_SLOT_META: Readonly<Record<ReceiveSlot, SlotMeta>> = {
  S: { label: "舉球", position: "S" },
  OPP: { label: "副攻", position: "OPP" },
  OH1: { label: "主攻1", position: "OH" },
  OH2: { label: "主攻2", position: "OH" },
  MB1: { label: "攔中1", position: "MB" },
  MB2: { label: "攔中2", position: "MB" },
  L: { label: "自由", position: "L" },
};
```

- [ ] **Step 7: 確認通過**

Run: `npx vitest run src/lib/formations`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/stores/authStore.ts src/lib/formations
git commit -m "新增站位半場幾何、輪轉計算與格子定義"
```

（以下前端 Task 的指令皆在 `volleyballtrainingtracker.client` 目錄執行，git 路徑相對該目錄。）

---

### Task 5: 位置錯誤檢查

**Files:**
- Create: `src/lib/formations/overlap.ts`
- Test: `src/lib/formations/overlap.test.ts`

**Interfaces:**
- Consumes: `rotationLineup`、`RECEIVE_SLOT_META`、`Point`
- Produces: `interface OverlapViolation { a: ReceiveSlot; b: ReceiveSlot; message: string }`、`checkOverlap(rotation: RotationNo, frame: Partial<Record<ReceiveSlot, Point>>): OverlapViolation[]`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, expect, it } from "vitest";
import type { Point } from "./geometry";
import type { ReceiveSlot } from "./rotation";
import { checkOverlap } from "./overlap";

// R1：4=OH1 3=S 2=MB1 / 5=L 6=OPP 1=OH2
const legalR1 = (): Partial<Record<ReceiveSlot, Point>> => ({
  OH1: { x: 0.17, y: 0.1 },
  S: { x: 0.5, y: 0.1 },
  MB1: { x: 0.83, y: 0.1 },
  L: { x: 0.17, y: 0.6 },
  OPP: { x: 0.5, y: 0.6 },
  OH2: { x: 0.83, y: 0.6 },
});

describe("checkOverlap", () => {
  it("合法站位沒有違規", () => {
    expect(checkOverlap(1, legalR1())).toEqual([]);
  });

  it("前排左右錯位", () => {
    const f = { ...legalR1(), OH1: { x: 0.6, y: 0.1 } };
    const v = checkOverlap(1, f);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ a: "OH1", b: "S" });
    expect(v[0].message).toBe("4號位（主攻1）須在3號位（舉球）左側");
  });

  it("前後錯位（自由以 5 號位判斷）", () => {
    const f = { ...legalR1(), L: { x: 0.17, y: 0.05 } };
    const v = checkOverlap(1, f);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ a: "OH1", b: "L" });
    expect(v[0].message).toBe("4號位（主攻1）須比5號位（自由）靠近球網");
  });

  it("座標相等視為違規", () => {
    const f = { ...legalR1(), S: { x: 0.83, y: 0.1 } };
    expect(checkOverlap(1, f).some((x) => x.a === "S" && x.b === "MB1")).toBe(true);
  });

  it("缺少格子時略過該組判斷", () => {
    const f = legalR1();
    delete f.S;
    expect(checkOverlap(1, f)).toEqual([]);
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `npx vitest run src/lib/formations/overlap.test.ts` → FAIL（模組不存在）。

- [ ] **Step 3: 實作**

```ts
// 接發位置錯誤（overlap）檢查：發球擊球瞬間，
//   前排左右 4 < 3 < 2、後排左右 5 < 6 < 1（x 遞增）；
//   前後 4 比 5、3 比 6、2 比 1 更靠近球網（y 較小）。相等視為違規。
// 自由球員以其替換之攔中的號位判斷（rotationLineup 已把該號位標為 L）。
import type { Point } from "./geometry";
import { rotationLineup, type CourtPos, type ReceiveSlot, type RotationNo } from "./rotation";
import { RECEIVE_SLOT_META } from "./slots";

export interface OverlapViolation {
  a: ReceiveSlot;
  b: ReceiveSlot;
  message: string;
}

const LEFT_RIGHT: ReadonlyArray<[CourtPos, CourtPos]> = [[4, 3], [3, 2], [5, 6], [6, 1]];
const FRONT_BACK: ReadonlyArray<[CourtPos, CourtPos]> = [[4, 5], [3, 6], [2, 1]];

export function checkOverlap(
  rotation: RotationNo,
  frame: Partial<Record<ReceiveSlot, Point>>,
): OverlapViolation[] {
  const lineup = rotationLineup(rotation);
  const desc = (pos: CourtPos) => `${pos}號位（${RECEIVE_SLOT_META[lineup[pos]].label}）`;
  const out: OverlapViolation[] = [];

  for (const [pa, pb] of LEFT_RIGHT) {
    const a = frame[lineup[pa]];
    const b = frame[lineup[pb]];
    if (a && b && !(a.x < b.x)) {
      out.push({ a: lineup[pa], b: lineup[pb], message: `${desc(pa)}須在${desc(pb)}左側` });
    }
  }
  for (const [pa, pb] of FRONT_BACK) {
    const a = frame[lineup[pa]];
    const b = frame[lineup[pb]];
    if (a && b && !(a.y < b.y)) {
      out.push({ a: lineup[pa], b: lineup[pb], message: `${desc(pa)}須比${desc(pb)}靠近球網` });
    }
  }
  return out;
}
```

- [ ] **Step 4: 確認通過**：`npx vitest run src/lib/formations/overlap.test.ts` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/formations/overlap.ts src/lib/formations/overlap.test.ts
git commit -m "新增接發位置錯誤檢查"
```

---

### Task 6: Layout 型別、內建預設站位、容錯解析器

**Files:**
- Create: `src/lib/formations/layout.ts`
- Create: `src/lib/formations/defaults.ts`
- Test: `src/lib/formations/layout.test.ts`

**Interfaces:**
- Consumes: Task 4、Task 5
- Produces（layout.ts）：
  - `type DefenseBaseKey = "setterFront" | "setterBack"`、`DEFENSE_BASE_KEYS`、`DEFENSE_BASE_LABEL: Record<DefenseBaseKey,string>`
  - `type DefenseFrame = Record<DefenseSlot, Point>`、`interface DefenseSituation { id; name; positions: Record<DefenseBaseKey, DefenseFrame> }`、`interface DefenseLayout { version: 1; bases: Record<DefenseBaseKey, DefenseFrame>; situations: DefenseSituation[] }`
  - `type ReceiveFrame = Partial<Record<ReceiveSlot, Point>>`、`type ReceiveFrameKey = "receive" | "attack"`、`interface ReceiveRotation { rotation: RotationNo; receive: ReceiveFrame; attack: ReceiveFrame }`、`interface ReceiveLayout { version: 1; rotations: ReceiveRotation[] }`
  - `type ReceiveSystem = "receive-opp" | "receive-2oh"`、`RECEIVE_SYSTEMS: ReadonlyArray<{ key: ReceiveSystem; label: string }>`
  - `SITUATION_NAME_MAX = 20`、`newSituationId(): string`
  - `interface ParseResult<T> { layout: T; recovered: boolean }`、`parseDefenseLayout(raw: unknown): ParseResult<DefenseLayout>`、`parseReceiveLayout(raw: unknown, system: ReceiveSystem): ParseResult<ReceiveLayout>`
- Produces（defaults.ts）：`defaultDefenseLayout(): DefenseLayout`、`defaultReceiveLayout(system: ReceiveSystem): ReceiveLayout`、`receiversFor(system, rotation): ReadonlySet<ReceiveSlot>`

- [ ] **Step 1: 寫失敗測試**

`src/lib/formations/layout.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { defaultDefenseLayout, defaultReceiveLayout, receiversFor } from "./defaults";
import { parseDefenseLayout, parseReceiveLayout, RECEIVE_SYSTEMS } from "./layout";
import { checkOverlap } from "./overlap";
import { onCourtSlots, ROTATIONS } from "./rotation";
import { DEFENSE_SLOTS } from "./slots";

describe("預設站位", () => {
  it("防守預設：兩組基本站位齊全、5 個情況", () => {
    const d = defaultDefenseLayout();
    for (const k of ["setterFront", "setterBack"] as const) {
      expect(Object.keys(d.bases[k]).sort()).toEqual([...DEFENSE_SLOTS].sort());
    }
    expect(d.situations.map((s) => s.name)).toEqual([
      "對方打4號位", "對方打2號位", "對方中間快攻", "對方吊球", "機會球",
    ]);
  });

  it.each(RECEIVE_SYSTEMS.map((s) => s.key))("%s 預設接發站位全部合法且格子正確", (system) => {
    const l = defaultReceiveLayout(system);
    expect(l.rotations.map((r) => r.rotation)).toEqual([...ROTATIONS]);
    for (const r of l.rotations) {
      expect(Object.keys(r.receive).sort()).toEqual([...onCourtSlots(r.rotation)].sort());
      expect(Object.keys(r.attack).sort()).toEqual([...onCourtSlots(r.rotation)].sort());
      expect(checkOverlap(r.rotation, r.receive)).toEqual([]);
    }
  });

  it("舉對＋自由＋1大砲：接發者為副攻、自由、後排主攻", () => {
    // R1 後排主攻為 OH2（1 號位）
    expect([...receiversFor("receive-opp", 1)].sort()).toEqual(["L", "OH2", "OPP"]);
    expect([...receiversFor("receive-2oh", 1)].sort()).toEqual(["L", "OH1", "OH2"]);
  });
});

describe("parseDefenseLayout", () => {
  it("正常資料原樣保留", () => {
    const d = defaultDefenseLayout();
    expect(parseDefenseLayout(JSON.parse(JSON.stringify(d)))).toEqual({ layout: d, recovered: false });
  });

  it("null／版本錯誤／非物件 → 整套退回預設並標記 recovered", () => {
    for (const raw of [null, { version: 2 }, "x", []]) {
      const r = parseDefenseLayout(raw);
      expect(r.recovered).toBe(true);
      expect(r.layout).toEqual(defaultDefenseLayout());
    }
  });

  it("缺格以預設補、越界夾回、非數字以預設補", () => {
    const d = defaultDefenseLayout();
    const raw = JSON.parse(JSON.stringify(d));
    delete raw.bases.setterFront.S;
    raw.bases.setterFront.OPP = { x: 5, y: -1 };
    raw.bases.setterBack.MB = { x: "a", y: 0.2 };
    const r = parseDefenseLayout(raw);
    expect(r.recovered).toBe(false);
    expect(r.layout.bases.setterFront.S).toEqual(d.bases.setterFront.S);
    expect(r.layout.bases.setterFront.OPP).toEqual({ x: 1, y: 0 });
    expect(r.layout.bases.setterBack.MB).toEqual(d.bases.setterBack.MB);
  });

  it("名稱空白或過長的情況被略過；重複 id 重新產生", () => {
    const d = defaultDefenseLayout();
    const raw = JSON.parse(JSON.stringify(d));
    raw.situations[0].name = "   ";
    raw.situations[1].name = "一".repeat(21);
    raw.situations[3].id = raw.situations[2].id;
    const r = parseDefenseLayout(raw);
    expect(r.layout.situations.map((s) => s.name)).toEqual(["對方中間快攻", "對方吊球", "機會球"]);
    const ids = r.layout.situations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseReceiveLayout", () => {
  it("正常資料原樣保留", () => {
    const l = defaultReceiveLayout("receive-2oh");
    expect(parseReceiveLayout(JSON.parse(JSON.stringify(l)), "receive-2oh")).toEqual({
      layout: l,
      recovered: false,
    });
  });

  it("缺輪轉補預設、多餘格子忽略", () => {
    const l = defaultReceiveLayout("receive-opp");
    const raw = JSON.parse(JSON.stringify(l));
    raw.rotations = raw.rotations.filter((r: { rotation: number }) => r.rotation !== 3);
    raw.rotations[0].receive.MB2 = { x: 0.5, y: 0.5 }; // R1 的 MB2 由自由替換，不在場上
    const r = parseReceiveLayout(raw, "receive-opp");
    expect(r.layout.rotations[2]).toEqual(l.rotations[2]);
    expect(r.layout.rotations[0].receive.MB2).toBeUndefined();
  });

  it("格式錯誤 → 預設＋recovered", () => {
    const r = parseReceiveLayout({ version: 1, rotations: "x" }, "receive-opp");
    expect(r.recovered).toBe(true);
    expect(r.layout).toEqual(defaultReceiveLayout("receive-opp"));
  });
});
```

- [ ] **Step 2: 確認失敗**：`npx vitest run src/lib/formations/layout.test.ts` → FAIL。

- [ ] **Step 3: 實作 layout.ts**

```ts
// 站位 Layout（存於 DB 的 jsonb 文件）型別與容錯解析器。
// 解析器永不丟例外：缺格／非數字以預設補、越界夾回；整體格式錯誤才整套退回預設（recovered=true）。
import { clampPoint, type Point } from "./geometry";
import { onCourtSlots, ROTATIONS, type ReceiveSlot, type RotationNo } from "./rotation";
import { DEFENSE_SLOTS, type DefenseSlot } from "./slots";
import { defaultDefenseLayout, defaultReceiveLayout } from "./defaults";

export type DefenseBaseKey = "setterFront" | "setterBack";
export const DEFENSE_BASE_KEYS: readonly DefenseBaseKey[] = ["setterFront", "setterBack"];
export const DEFENSE_BASE_LABEL: Readonly<Record<DefenseBaseKey, string>> = {
  setterFront: "舉球員前排",
  setterBack: "舉球員後排",
};

export type DefenseFrame = Record<DefenseSlot, Point>;

export interface DefenseSituation {
  id: string;
  name: string;
  positions: Record<DefenseBaseKey, DefenseFrame>;
}

export interface DefenseLayout {
  version: 1;
  bases: Record<DefenseBaseKey, DefenseFrame>;
  situations: DefenseSituation[];
}

export type ReceiveFrame = Partial<Record<ReceiveSlot, Point>>;
export type ReceiveFrameKey = "receive" | "attack";

export interface ReceiveRotation {
  rotation: RotationNo;
  receive: ReceiveFrame;
  attack: ReceiveFrame;
}

export interface ReceiveLayout {
  version: 1;
  rotations: ReceiveRotation[];
}

export type ReceiveSystem = "receive-opp" | "receive-2oh";
export const RECEIVE_SYSTEMS: ReadonlyArray<{ key: ReceiveSystem; label: string }> = [
  { key: "receive-opp", label: "舉對＋自由＋1大砲" },
  { key: "receive-2oh", label: "2大砲＋自由" },
];

export const SITUATION_NAME_MAX = 20;

export const newSituationId = () => Math.random().toString(36).slice(2, 10);

export interface ParseResult<T> {
  layout: T;
  /** true＝整體格式異常，已整套退回預設（頁面需提示） */
  recovered: boolean;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function parsePoint(v: unknown): Point | null {
  if (!isObj(v)) return null;
  const { x, y } = v;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return clampPoint({ x, y });
}

function parseFrame<S extends string>(
  raw: unknown,
  slots: readonly S[],
  fallback: Partial<Record<S, Point>>,
): Partial<Record<S, Point>> {
  const src: Obj = isObj(raw) ? raw : {};
  const out: Partial<Record<S, Point>> = {};
  for (const s of slots) {
    const p = parsePoint(src[s]);
    const fb = fallback[s];
    if (p) out[s] = p;
    else if (fb) out[s] = { ...fb };
  }
  return out;
}

export function parseDefenseLayout(raw: unknown): ParseResult<DefenseLayout> {
  const def = defaultDefenseLayout();
  if (!isObj(raw) || raw.version !== 1 || !isObj(raw.bases)) return { layout: def, recovered: true };
  const rawBases = raw.bases;

  const bases = {} as Record<DefenseBaseKey, DefenseFrame>;
  for (const k of DEFENSE_BASE_KEYS) {
    bases[k] = parseFrame(rawBases[k], DEFENSE_SLOTS, def.bases[k]) as DefenseFrame;
  }

  const situations: DefenseSituation[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(raw.situations) ? raw.situations : []) {
    if (!isObj(s) || typeof s.name !== "string") continue;
    const name = s.name.trim();
    if (!name || name.length > SITUATION_NAME_MAX) continue;
    let id = typeof s.id === "string" && s.id ? s.id : newSituationId();
    if (seen.has(id)) id = newSituationId();
    seen.add(id);
    const pos: Obj = isObj(s.positions) ? s.positions : {};
    // 情況缺格時以「同組基本站位」補上
    situations.push({
      id,
      name,
      positions: {
        setterFront: parseFrame(pos.setterFront, DEFENSE_SLOTS, bases.setterFront) as DefenseFrame,
        setterBack: parseFrame(pos.setterBack, DEFENSE_SLOTS, bases.setterBack) as DefenseFrame,
      },
    });
  }

  return { layout: { version: 1, bases, situations }, recovered: false };
}

export function parseReceiveLayout(raw: unknown, system: ReceiveSystem): ParseResult<ReceiveLayout> {
  const def = defaultReceiveLayout(system);
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.rotations)) {
    return { layout: def, recovered: true };
  }
  const byNo = new Map<number, Obj>();
  for (const r of raw.rotations) {
    if (isObj(r) && typeof r.rotation === "number") byNo.set(r.rotation, r);
  }
  const rotations = ROTATIONS.map((no, i): ReceiveRotation => {
    const src = byNo.get(no) ?? {};
    const slots = onCourtSlots(no);
    const d = def.rotations[i];
    return {
      rotation: no,
      receive: parseFrame(src.receive, slots, d.receive),
      attack: parseFrame(src.attack, slots, d.attack),
    };
  });
  return { layout: { version: 1, rotations }, recovered: false };
}
```

- [ ] **Step 4: 實作 defaults.ts**

```ts
// 內建預設站位：DB 尚無資料時顯示，教練從這裡開始調整。
// 防守：以「場上六個區位」定義座標，再依舉球員前排／後排對應到格子。
// 接發：依輪轉自動產生合法站位（測試保證全部通過位置錯誤檢查）。
import type { Point } from "./geometry";
import type { DefenseBaseKey, DefenseFrame, DefenseLayout, ReceiveFrame, ReceiveLayout, ReceiveSystem } from "./layout";
import {
  COURT_POSITIONS,
  isFrontRow,
  rotationLineup,
  ROTATIONS,
  type CourtPos,
  type ReceiveSlot,
  type RotationNo,
} from "./rotation";
import { RECEIVE_SLOT_META, type DefenseSlot } from "./slots";

// ---------- 防守 ----------

/** 區位：前排左／中／右、後排左／中／右 */
type Spot = "LF" | "MF" | "RF" | "LB" | "MBk" | "RB";

const SPOT_SLOT: Readonly<Record<DefenseBaseKey, Record<Spot, DefenseSlot>>> = {
  setterFront: { LF: "OHF", MF: "MB", RF: "S", LB: "L", MBk: "OHB", RB: "OPP" },
  setterBack: { LF: "OHF", MF: "MB", RF: "OPP", LB: "L", MBk: "OHB", RB: "S" },
};

const BASE_SPOTS: Record<Spot, Point> = {
  LF: { x: 0.17, y: 0.09 },
  MF: { x: 0.5, y: 0.09 },
  RF: { x: 0.83, y: 0.09 },
  LB: { x: 0.12, y: 0.55 },
  MBk: { x: 0.5, y: 0.68 },
  RB: { x: 0.88, y: 0.55 },
};

const SITUATION_SPOTS: ReadonlyArray<{ name: string; spots: Record<Spot, Point> }> = [
  {
    name: "對方打4號位",
    spots: {
      LF: { x: 0.12, y: 0.3 }, MF: { x: 0.66, y: 0.04 }, RF: { x: 0.78, y: 0.04 },
      LB: { x: 0.15, y: 0.55 }, MBk: { x: 0.6, y: 0.78 }, RB: { x: 0.88, y: 0.6 },
    },
  },
  {
    name: "對方打2號位",
    spots: {
      LF: { x: 0.22, y: 0.04 }, MF: { x: 0.34, y: 0.04 }, RF: { x: 0.88, y: 0.3 },
      LB: { x: 0.12, y: 0.6 }, MBk: { x: 0.4, y: 0.78 }, RB: { x: 0.85, y: 0.55 },
    },
  },
  {
    name: "對方中間快攻",
    spots: {
      LF: { x: 0.15, y: 0.15 }, MF: { x: 0.5, y: 0.04 }, RF: { x: 0.85, y: 0.15 },
      LB: { x: 0.2, y: 0.5 }, MBk: { x: 0.5, y: 0.7 }, RB: { x: 0.8, y: 0.5 },
    },
  },
  {
    name: "對方吊球",
    spots: {
      LF: { x: 0.17, y: 0.06 }, MF: { x: 0.5, y: 0.04 }, RF: { x: 0.83, y: 0.06 },
      LB: { x: 0.2, y: 0.35 }, MBk: { x: 0.5, y: 0.6 }, RB: { x: 0.8, y: 0.35 },
    },
  },
  {
    name: "機會球",
    spots: {
      LF: { x: 0.1, y: 0.3 }, MF: { x: 0.5, y: 0.32 }, RF: { x: 0.9, y: 0.3 },
      LB: { x: 0.15, y: 0.6 }, MBk: { x: 0.5, y: 0.62 }, RB: { x: 0.85, y: 0.6 },
    },
  },
];

function frameFromSpots(base: DefenseBaseKey, spots: Record<Spot, Point>): DefenseFrame {
  const f = {} as DefenseFrame;
  for (const s of Object.keys(spots) as Spot[]) f[SPOT_SLOT[base][s]] = { ...spots[s] };
  return f;
}

export function defaultDefenseLayout(): DefenseLayout {
  return {
    version: 1,
    bases: {
      setterFront: frameFromSpots("setterFront", BASE_SPOTS),
      setterBack: frameFromSpots("setterBack", BASE_SPOTS),
    },
    situations: SITUATION_SPOTS.map((s, i) => ({
      id: `d${i + 1}`,
      name: s.name,
      positions: {
        setterFront: frameFromSpots("setterFront", s.spots),
        setterBack: frameFromSpots("setterBack", s.spots),
      },
    })),
  };
}

// ---------- 接發 ----------

/** 該體系在此輪轉的接發者 */
export function receiversFor(system: ReceiveSystem, rotation: RotationNo): ReadonlySet<ReceiveSlot> {
  if (system === "receive-2oh") return new Set<ReceiveSlot>(["OH1", "OH2", "L"]);
  const lineup = rotationLineup(rotation);
  const backOh = COURT_POSITIONS.map((p) => ({ p, s: lineup[p] })).find(
    ({ p, s }) => !isFrontRow(p) && (s === "OH1" || s === "OH2"),
  );
  const set = new Set<ReceiveSlot>(["OPP", "L"]);
  if (backOh) set.add(backOh.s);
  return set;
}

const COLUMN_X: Readonly<Record<CourtPos, number>> = { 4: 0.17, 5: 0.17, 3: 0.5, 6: 0.5, 2: 0.83, 1: 0.83 };
/** 後排號位 → 同一直行的前排號位 */
const FRONT_OF: Readonly<Partial<Record<CourtPos, CourtPos>>> = { 5: 4, 6: 3, 1: 2 };

function defaultReceiveFrame(system: ReceiveSystem, rotation: RotationNo): ReceiveFrame {
  const lineup = rotationLineup(rotation);
  const recv = receiversFor(system, rotation);
  const frontY = (pos: CourtPos) => (recv.has(lineup[pos]) ? 0.48 : 0.08);
  const frame: ReceiveFrame = {};
  for (const pos of COURT_POSITIONS) {
    const slot = lineup[pos];
    let y: number;
    if (isFrontRow(pos)) {
      y = frontY(pos);
    } else {
      const fy = frontY(FRONT_OF[pos] as CourtPos);
      // 接發者站一排；非接發者（如後排舉球員）躲在同一直行前排隊友正後方
      y = recv.has(slot) ? Math.max(0.58, fy + 0.06) : fy + 0.06;
    }
    frame[slot] = { x: COLUMN_X[pos], y };
  }
  return frame;
}

const FRONT_ATTACK: Readonly<Record<string, Point>> = {
  OH: { x: 0.08, y: 0.28 },
  MB: { x: 0.5, y: 0.22 },
  OPP: { x: 0.92, y: 0.28 },
};
const BACK_ATTACK: Readonly<Record<string, Point>> = {
  OH: { x: 0.5, y: 0.62 },
  MB: { x: 0.5, y: 0.62 },
  OPP: { x: 0.82, y: 0.62 },
};

function defaultAttackFrame(rotation: RotationNo): ReceiveFrame {
  const lineup = rotationLineup(rotation);
  const frame: ReceiveFrame = {};
  for (const pos of COURT_POSITIONS) {
    const slot = lineup[pos];
    const role = RECEIVE_SLOT_META[slot].position;
    frame[slot] =
      slot === "S"
        ? { x: 0.66, y: 0.05 }
        : slot === "L"
          ? { x: 0.2, y: 0.62 }
          : { ...(isFrontRow(pos) ? FRONT_ATTACK[role] : BACK_ATTACK[role]) };
  }
  return frame;
}

export function defaultReceiveLayout(system: ReceiveSystem): ReceiveLayout {
  return {
    version: 1,
    rotations: ROTATIONS.map((r) => ({
      rotation: r,
      receive: defaultReceiveFrame(system, r),
      attack: defaultAttackFrame(r),
    })),
  };
}
```

- [ ] **Step 5: 確認通過**：`npx vitest run src/lib/formations` → PASS。若「預設接發站位全部合法」失敗，調整 `defaultReceiveFrame` 的 y 值直到通過（不得放寬 `checkOverlap`）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/formations/layout.ts src/lib/formations/defaults.ts src/lib/formations/layout.test.ts
git commit -m "新增站位 Layout 型別、內建預設與容錯解析器"
```

---

### Task 7: 站位編輯操作與陣容預填

**Files:**
- Create: `src/lib/formations/ops.ts`
- Create: `src/lib/formations/lineup.ts`
- Test: `src/lib/formations/ops.test.ts`
- Test: `src/lib/formations/lineup.test.ts`

**Interfaces:**
- Consumes: Task 4、Task 6
- Produces（ops.ts）：`BASE_FRAME_ID = "base"`、`normalizeSituationName(name): string | null`、`setDefensePoint(l, base, frameId, slot, p): DefenseLayout`、`addSituation(l, name): { layout: DefenseLayout; id: string } | null`、`renameSituation(l, id, name): DefenseLayout | null`、`removeSituation(l, id): DefenseLayout`、`moveSituation(l, id, dir: -1 | 1): DefenseLayout`、`resetSituationFromBase(l, id, base): DefenseLayout`、`setReceivePoint(l, rotation, frame: ReceiveFrameKey, slot, p): ReceiveLayout`
- Produces（lineup.ts）：`type SlotAssignment<S extends string> = Partial<Record<S, RosterPlayer>>`、`autoAssign(slots, meta, roster)`、`assignPlayer(current, slot, player)`、`clearSlot(current, slot)`

- [ ] **Step 1: 寫失敗測試**

`src/lib/formations/ops.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { defaultDefenseLayout, defaultReceiveLayout } from "./defaults";
import {
  addSituation,
  BASE_FRAME_ID,
  moveSituation,
  removeSituation,
  renameSituation,
  resetSituationFromBase,
  setDefensePoint,
  setReceivePoint,
} from "./ops";

describe("防守編輯操作", () => {
  it("改基本站位只動該組該格，不影響情況", () => {
    const l = defaultDefenseLayout();
    const n = setDefensePoint(l, "setterFront", BASE_FRAME_ID, "S", { x: 0.1, y: 0.1 });
    expect(n.bases.setterFront.S).toEqual({ x: 0.1, y: 0.1 });
    expect(n.bases.setterBack).toEqual(l.bases.setterBack);
    expect(n.situations).toEqual(l.situations);
    expect(l.bases.setterFront.S).not.toEqual({ x: 0.1, y: 0.1 }); // 不可變更原物件
  });

  it("改情況只動該情況該組", () => {
    const l = defaultDefenseLayout();
    const id = l.situations[1].id;
    const n = setDefensePoint(l, "setterBack", id, "L", { x: 0.3, y: 0.3 });
    expect(n.situations[1].positions.setterBack.L).toEqual({ x: 0.3, y: 0.3 });
    expect(n.situations[1].positions.setterFront).toEqual(l.situations[1].positions.setterFront);
    expect(n.situations[0]).toEqual(l.situations[0]);
  });

  it("新增情況：trim、複製兩組基本站位、加在最後", () => {
    const l = defaultDefenseLayout();
    const res = addSituation(l, "  對方後排攻擊 ");
    expect(res).not.toBeNull();
    const added = res!.layout.situations.at(-1)!;
    expect(added).toMatchObject({ id: res!.id, name: "對方後排攻擊" });
    expect(added.positions).toEqual(l.bases);
    expect(added.positions.setterFront).not.toBe(l.bases.setterFront);
  });

  it.each(["", "   ", "一".repeat(21)])("名稱 %j 無效：新增與改名皆拒絕", (bad) => {
    const l = defaultDefenseLayout();
    expect(addSituation(l, bad)).toBeNull();
    expect(renameSituation(l, l.situations[0].id, bad)).toBeNull();
  });

  it("改名、刪除、移動", () => {
    const l = defaultDefenseLayout();
    const [a, b] = l.situations;
    expect(renameSituation(l, a.id, "新名稱")!.situations[0].name).toBe("新名稱");
    expect(removeSituation(l, a.id).situations.map((s) => s.id)).not.toContain(a.id);
    expect(moveSituation(l, b.id, -1).situations.slice(0, 2).map((s) => s.id)).toEqual([b.id, a.id]);
    expect(moveSituation(l, a.id, -1)).toEqual(l); // 已在最前不動
  });

  it("從基本站位重新套用：只覆寫該情況該組", () => {
    const l = defaultDefenseLayout();
    const id = l.situations[0].id;
    const n = resetSituationFromBase(l, id, "setterFront");
    expect(n.situations[0].positions.setterFront).toEqual(l.bases.setterFront);
    expect(n.situations[0].positions.setterBack).toEqual(l.situations[0].positions.setterBack);
  });
});

describe("接發編輯操作", () => {
  it("只動指定輪轉與影格", () => {
    const l = defaultReceiveLayout("receive-opp");
    const n = setReceivePoint(l, 2, "attack", "S", { x: 0.7, y: 0.02 });
    expect(n.rotations[1].attack.S).toEqual({ x: 0.7, y: 0.02 });
    expect(n.rotations[1].receive).toEqual(l.rotations[1].receive);
    expect(n.rotations[0]).toEqual(l.rotations[0]);
  });
});
```

`src/lib/formations/lineup.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import type { RosterPlayer } from "@/lib/court";
import { assignPlayer, autoAssign, clearSlot } from "./lineup";
import { DEFENSE_SLOTS, DEFENSE_SLOT_META, RECEIVE_SLOTS, RECEIVE_SLOT_META } from "./slots";

const p = (playerId: number, jerseyNo: number | null, position: string | null, name = `P${playerId}`): RosterPlayer => ({
  playerId, jerseyNo, name, position,
});

describe("autoAssign", () => {
  it("依主要位置與背號配對（主攻1 拿背號小的）", () => {
    const roster = [p(1, 12, "OH"), p(2, 3, "OH,OPP"), p(3, 7, "S"), p(4, 9, "MB"), p(5, 2, "MB"), p(6, 5, "L"), p(7, 8, "OPP")];
    const a = autoAssign(RECEIVE_SLOTS, RECEIVE_SLOT_META, roster);
    expect(a.OH1?.playerId).toBe(2);
    expect(a.OH2?.playerId).toBe(1);
    expect(a.MB1?.playerId).toBe(5);
    expect(a.MB2?.playerId).toBe(4);
    expect(a.S?.playerId).toBe(3);
    expect(a.L?.playerId).toBe(6);
    expect(a.OPP?.playerId).toBe(7);
  });

  it("人數不足或無位置的球員 → 該格留空（顯示代號），不塞錯位置的人", () => {
    const roster = [p(1, 1, "OH"), p(2, 2, null), p(3, 3, "")];
    const a = autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, roster);
    expect(a.OHF?.playerId).toBe(1);
    expect(a.OHB).toBeUndefined();
    expect(a.S).toBeUndefined();
    expect(Object.keys(a)).toEqual(["OHF"]);
  });

  it("背號為 null 的排最後，同背號依姓名", () => {
    const roster = [p(1, null, "OH", "甲"), p(2, 4, "OH", "乙")];
    const a = autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, roster);
    expect(a.OHF?.playerId).toBe(2);
    expect(a.OHB?.playerId).toBe(1);
  });
});

describe("assignPlayer / clearSlot", () => {
  it("選到已在別格的球員時兩格互換", () => {
    const x = p(1, 1, "OH");
    const y = p(2, 2, "OH");
    const n = assignPlayer({ OHF: x, OHB: y }, "OHF", y);
    expect(n.OHF?.playerId).toBe(2);
    expect(n.OHB?.playerId).toBe(1);
  });

  it("原格為空時，被選走的那格清空", () => {
    const y = p(2, 2, "OH");
    const n = assignPlayer({ OHB: y }, "OHF", y);
    expect(n).toEqual({ OHF: y });
  });

  it("clearSlot 清除該格", () => {
    expect(clearSlot({ OHF: p(1, 1, "OH") }, "OHF")).toEqual({});
  });
});
```

- [ ] **Step 2: 確認失敗**：`npx vitest run src/lib/formations` → FAIL。

- [ ] **Step 3: 實作 ops.ts**

```ts
// 站位編輯的純函式（不可變更新），頁面以 useFormation().update(fn) 套用。
import type { Point } from "./geometry";
import {
  newSituationId,
  SITUATION_NAME_MAX,
  type DefenseBaseKey,
  type DefenseLayout,
  type ReceiveFrameKey,
  type ReceiveLayout,
} from "./layout";
import type { ReceiveSlot, RotationNo } from "./rotation";
import type { DefenseSlot } from "./slots";

/** 防守頁「基本站位」的影格 id（情況 id 由 newSituationId 產生，不會撞到） */
export const BASE_FRAME_ID = "base";

export function normalizeSituationName(name: string): string | null {
  const t = name.trim();
  return t && t.length <= SITUATION_NAME_MAX ? t : null;
}

export function setDefensePoint(
  l: DefenseLayout,
  base: DefenseBaseKey,
  frameId: string,
  slot: DefenseSlot,
  p: Point,
): DefenseLayout {
  if (frameId === BASE_FRAME_ID) {
    return { ...l, bases: { ...l.bases, [base]: { ...l.bases[base], [slot]: p } } };
  }
  return {
    ...l,
    situations: l.situations.map((s) =>
      s.id !== frameId
        ? s
        : { ...s, positions: { ...s.positions, [base]: { ...s.positions[base], [slot]: p } } },
    ),
  };
}

export function addSituation(l: DefenseLayout, name: string): { layout: DefenseLayout; id: string } | null {
  const n = normalizeSituationName(name);
  if (!n) return null;
  const id = newSituationId();
  return {
    id,
    layout: {
      ...l,
      situations: [
        ...l.situations,
        { id, name: n, positions: { setterFront: structuredClone(l.bases.setterFront), setterBack: structuredClone(l.bases.setterBack) } },
      ],
    },
  };
}

export function renameSituation(l: DefenseLayout, id: string, name: string): DefenseLayout | null {
  const n = normalizeSituationName(name);
  if (!n) return null;
  return { ...l, situations: l.situations.map((s) => (s.id === id ? { ...s, name: n } : s)) };
}

export function removeSituation(l: DefenseLayout, id: string): DefenseLayout {
  return { ...l, situations: l.situations.filter((s) => s.id !== id) };
}

export function moveSituation(l: DefenseLayout, id: string, dir: -1 | 1): DefenseLayout {
  const i = l.situations.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.situations.length) return l;
  const list = [...l.situations];
  [list[i], list[j]] = [list[j], list[i]];
  return { ...l, situations: list };
}

export function resetSituationFromBase(l: DefenseLayout, id: string, base: DefenseBaseKey): DefenseLayout {
  return {
    ...l,
    situations: l.situations.map((s) =>
      s.id !== id ? s : { ...s, positions: { ...s.positions, [base]: structuredClone(l.bases[base]) } },
    ),
  };
}

export function setReceivePoint(
  l: ReceiveLayout,
  rotation: RotationNo,
  frame: ReceiveFrameKey,
  slot: ReceiveSlot,
  p: Point,
): ReceiveLayout {
  return {
    ...l,
    rotations: l.rotations.map((r) =>
      r.rotation !== rotation ? r : { ...r, [frame]: { ...r[frame], [slot]: p } },
    ),
  };
}
```

- [ ] **Step 4: 實作 lineup.ts**

```ts
// 陣容帶入：把賽事報名球員填進位置格子（只影響顯示，不寫入 DB）。
import type { RosterPlayer } from "@/lib/court";
import { primaryPosition } from "@/lib/positions";
import type { SlotMeta } from "./slots";

export type SlotAssignment<S extends string> = Partial<Record<S, RosterPlayer>>;

const byJersey = (a: RosterPlayer, b: RosterPlayer) =>
  (a.jerseyNo ?? Number.POSITIVE_INFINITY) - (b.jerseyNo ?? Number.POSITIVE_INFINITY) ||
  a.name.localeCompare(b.name, "zh-Hant");

/** 依球員主要位置自動預填；同位置多人時依背號（null 最後）、再依姓名 */
export function autoAssign<S extends string>(
  slots: readonly S[],
  meta: Readonly<Record<S, SlotMeta>>,
  roster: readonly RosterPlayer[],
): SlotAssignment<S> {
  const pools = new Map<string, RosterPlayer[]>();
  for (const p of [...roster].sort(byJersey)) {
    const pos = primaryPosition(p.position);
    if (!pos) continue;
    const list = pools.get(pos) ?? [];
    list.push(p);
    pools.set(pos, list);
  }
  const out: SlotAssignment<S> = {};
  for (const s of slots) {
    const next = pools.get(meta[s].position)?.shift();
    if (next) out[s] = next;
  }
  return out;
}

/** 指定某格球員；該球員已在別格時兩格互換（原格為空則別格清空） */
export function assignPlayer<S extends string>(
  current: SlotAssignment<S>,
  slot: S,
  player: RosterPlayer,
): SlotAssignment<S> {
  const next: SlotAssignment<S> = { ...current };
  const from = (Object.keys(next) as S[]).find(
    (k) => k !== slot && next[k]?.playerId === player.playerId,
  );
  if (from) {
    const displaced = next[slot];
    if (displaced) next[from] = displaced;
    else delete next[from];
  }
  next[slot] = player;
  return next;
}

export function clearSlot<S extends string>(current: SlotAssignment<S>, slot: S): SlotAssignment<S> {
  const next: SlotAssignment<S> = { ...current };
  delete next[slot];
  return next;
}
```

注意：`Number.POSITIVE_INFINITY - Number.POSITIVE_INFINITY` 為 NaN，`||` 會落到姓名比較，符合預期。

- [ ] **Step 5: 確認通過**：`npx vitest run src/lib/formations` → PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/formations/ops.ts src/lib/formations/ops.test.ts src/lib/formations/lineup.ts src/lib/formations/lineup.test.ts
git commit -m "新增站位編輯操作與陣容自動預填"
```

---

### Task 8: API client、未儲存離開保護、useFormation hook

**Files:**
- Create: `src/api/formations.ts`
- Create: `src/lib/useUnsavedGuard.ts`
- Test: `src/lib/useUnsavedGuard.test.ts`
- Create: `src/components/formations/useFormation.ts`
- Test: `src/components/formations/useFormation.test.tsx`

**Interfaces:**
- Consumes: Task 3 HTTP、Task 6 `ParseResult`
- Produces：
  - `type FormationKey = "defense" | "receive-opp" | "receive-2oh"`、`interface FormationDto`、`interface FormationConflict { message; version; updatedAt: string|null; updatedByName: string|null }`、`formationsApi.get(key)`、`formationsApi.save(key, { layout, expectedVersion })`、`getFormationConflict(err): FormationConflict | null`
  - `UNSAVED_CONFIRM`、`useUnsavedGuard(active: boolean): void`
  - `useFormation<T>(key, parse)` 回傳 `{ query, layout: T | null, editing, dirty, conflict, recovered, saving, updatedAt, updatedByName, startEdit(), update(fn: (prev: T) => T), cancel(), save(), reload() }`

- [ ] **Step 1: API client**

`src/api/formations.ts`：

```ts
import { api } from './client';

export type FormationKey = 'defense' | 'receive-opp' | 'receive-2oh';

export interface FormationDto {
  key: FormationKey;
  /** 尚未儲存過為 null（改用內建預設） */
  layout: unknown | null;
  /** 尚未儲存過為 0 */
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface FormationConflict {
  message: string;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const formationsApi = {
  get: (key: FormationKey) => api.get<FormationDto>(`/formations/${key}`).then((r) => r.data),
  save: (key: FormationKey, body: { layout: unknown; expectedVersion: number }) =>
    api.put<FormationDto>(`/formations/${key}`, body).then((r) => r.data),
};

/** PUT 回 409（版本不符）時取出衝突資訊；其他錯誤回 null */
export function getFormationConflict(err: unknown): FormationConflict | null {
  const e = err as { response?: { status?: number; data?: FormationConflict } };
  return e?.response?.status === 409 && e.response.data ? e.response.data : null;
}
```

- [ ] **Step 2: 寫 useUnsavedGuard 失敗測試**

`src/lib/useUnsavedGuard.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnsavedGuard } from "./useUnsavedGuard";

function clickLink() {
  const a = document.createElement("a");
  a.href = "/players";
  document.body.appendChild(a);
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  a.dispatchEvent(ev);
  a.remove();
  return ev;
}

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedGuard", () => {
  it("有未儲存修改時，點站內連結先確認；取消則攔下", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHook(() => useUnsavedGuard(true));
    expect(clickLink().defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("確認離開則放行", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() => useUnsavedGuard(true));
    expect(clickLink().defaultPrevented).toBe(false);
  });

  it("沒有未儲存修改時不打擾", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderHook(() => useUnsavedGuard(false));
    expect(clickLink().defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("卸載後移除監聽", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { unmount } = renderHook(() => useUnsavedGuard(true));
    unmount();
    expect(clickLink().defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/lib/useUnsavedGuard.test.ts` → FAIL。

- [ ] **Step 3: 實作 useUnsavedGuard**

`src/lib/useUnsavedGuard.ts`：

```ts
import { useEffect } from "react";

export const UNSAVED_CONFIRM = "站位有未儲存的修改，確定要離開嗎？";

/**
 * 有未儲存修改時保護離開：
 * - 關閉／重新整理分頁：beforeunload（瀏覽器原生提示）。
 * - 站內換頁：專案使用 BrowserRouter（非 data router），無法用 useBlocker；
 *   改在 document capture 階段攔截 <a> 點擊（側欄、底部列皆為連結），同步跳原生確認框，
 *   取消時 preventDefault + stopPropagation，React Router 的 Link 就不會導頁。
 *   瀏覽器「上一頁」不在保護範圍。
 */
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      if (!window.confirm(UNSAVED_CONFIRM)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
```

Run: `npx vitest run src/lib/useUnsavedGuard.test.ts` → PASS。

- [ ] **Step 4: 寫 useFormation 失敗測試**

`src/components/formations/useFormation.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { formationsApi } from "@/api/formations";
import { defaultDefenseLayout } from "@/lib/formations/defaults";
import { parseDefenseLayout } from "@/lib/formations/layout";
import { useFormation } from "./useFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const empty = { key: "defense" as const, layout: null, version: 0, updatedAt: null, updatedByName: null };

beforeEach(() => {
  vi.mocked(formationsApi.get).mockReset().mockResolvedValue(empty);
  vi.mocked(formationsApi.save).mockReset();
});

describe("useFormation", () => {
  it("尚未儲存過：顯示預設且不標記格式異常", async () => {
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    expect(result.current.layout).toEqual(defaultDefenseLayout());
    expect(result.current.recovered).toBe(false);
  });

  it("DB 資料損毀：標記格式異常", async () => {
    vi.mocked(formationsApi.get).mockResolvedValue({ ...empty, layout: { version: 9 }, version: 3 });
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.recovered).toBe(true));
  });

  it("編輯→修改→儲存：帶 expectedVersion，成功後離開編輯", async () => {
    vi.mocked(formationsApi.save).mockImplementation(async (_k, body) => ({
      ...empty, layout: body.layout, version: 1,
    }));
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    act(() => result.current.startEdit());
    act(() => result.current.update((l) => ({ ...l, situations: [] })));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.save());
    await waitFor(() => expect(result.current.editing).toBe(false));
    expect(vi.mocked(formationsApi.save).mock.calls[0][1].expectedVersion).toBe(0);
    expect(result.current.layout?.situations).toEqual([]);
  });

  it("409：保留草稿並提供衝突資訊", async () => {
    vi.mocked(formationsApi.save).mockRejectedValue({
      response: { status: 409, data: { message: "x", version: 2, updatedAt: "2026-10-19T00:00:00Z", updatedByName: "教練乙" } },
    });
    const { result } = renderHook(() => useFormation("defense", parseDefenseLayout), { wrapper });
    await waitFor(() => expect(result.current.layout).not.toBeNull());
    act(() => result.current.startEdit());
    act(() => result.current.update((l) => ({ ...l, situations: [] })));
    act(() => result.current.save());
    await waitFor(() => expect(result.current.conflict?.updatedByName).toBe("教練乙"));
    expect(result.current.editing).toBe(true);
    expect(result.current.layout?.situations).toEqual([]);
  });
});
```

Run: `npx vitest run src/components/formations/useFormation.test.tsx` → FAIL。

- [ ] **Step 5: 實作 useFormation**

`src/components/formations/useFormation.ts`：

```ts
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formationsApi,
  getFormationConflict,
  type FormationConflict,
  type FormationKey,
} from "@/api/formations";
import { getApiErrorMessage } from "@/api/client";
import type { ParseResult } from "@/lib/formations/layout";
import { toast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

/**
 * 一套站位的載入／編輯草稿／儲存／衝突處理。
 * - draft 非 null 即為編輯模式；檢視模式顯示 DB 版本（或內建預設）。
 * - parse 必須是穩定參考（模組層函式），否則每次 render 都會重新解析。
 * - 409 時保留草稿並回傳 conflict，讓使用者先看到別人改了什麼再決定重新載入。
 */
export function useFormation<T>(key: FormationKey, parse: (raw: unknown) => ParseResult<T>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["formation", key], queryFn: () => formationsApi.get(key) });

  const parsed = useMemo(() => {
    if (!query.data) return null;
    const r = parse(query.data.layout);
    // 從未儲存（layout=null）用預設是正常狀態，不算格式異常
    return { layout: r.layout, recovered: query.data.layout !== null && r.recovered };
  }, [query.data, parse]);

  const [draft, setDraft] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<FormationConflict | null>(null);
  useUnsavedGuard(dirty);

  const resetEdit = () => {
    setDraft(null);
    setDirty(false);
    setConflict(null);
  };

  const mutation = useMutation({
    mutationFn: (layout: T) =>
      formationsApi.save(key, { layout, expectedVersion: query.data?.version ?? 0 }),
    onSuccess: (dto) => {
      queryClient.setQueryData(["formation", key], dto);
      resetEdit();
      toast.success("站位已儲存");
    },
    onError: (err) => {
      const c = getFormationConflict(err);
      if (c) setConflict(c);
      else toast.error("儲存失敗", getApiErrorMessage(err));
    },
  });

  return {
    query,
    layout: draft ?? parsed?.layout ?? null,
    editing: draft !== null,
    dirty,
    conflict,
    recovered: parsed?.recovered ?? false,
    saving: mutation.isPending,
    updatedAt: query.data?.updatedAt ?? null,
    updatedByName: query.data?.updatedByName ?? null,
    startEdit: () => {
      if (!parsed) return;
      setDraft(structuredClone(parsed.layout));
      setDirty(false);
      setConflict(null);
    },
    update: (fn: (prev: T) => T) => {
      setDraft((prev) => (prev ? fn(prev) : prev));
      setDirty(true);
    },
    cancel: resetEdit,
    save: () => {
      if (draft) mutation.mutate(draft);
    },
    reload: async () => {
      resetEdit();
      await query.refetch();
    },
  };
}
```

- [ ] **Step 6: 確認通過**：`npx vitest run src/components/formations src/lib/useUnsavedGuard.test.ts` → PASS。

- [ ] **Step 7: Commit**

```bash
git add src/api/formations.ts src/lib/useUnsavedGuard.ts src/lib/useUnsavedGuard.test.ts src/components/formations/useFormation.ts src/components/formations/useFormation.test.tsx
git commit -m "新增站位 API client、未儲存離開保護與 useFormation"
```

---

### Task 9: 抽出名單來源 hook、賽事選擇器支援自訂首項標籤

**Files:**
- Create: `src/components/tactics/useRosterSource.ts`
- Modify: `src/components/tactics/MatchEventSelector.tsx`
- Modify: `src/pages/TacticsBoard.tsx`
- Test: 既有 `src/pages/TacticsBoard.test.tsx`（回歸）

**Interfaces:**
- Produces：`SQUAD_KEYS`、`useRosterSource({ loadAllPlayers: boolean })` 回傳 `{ mode, setMode, eventId, setEventId, squad, setSquad, playersQuery, eventsQuery, selectedEvent, activeSquad, squadOptions, roster: RosterPlayer[] | undefined, sourceKey: string }`；`MatchEventSelector` 新增選填 prop `allLabel?: string`（預設「全部球員」）

- [ ] **Step 1: 建立 hook（內容搬自 TacticsBoard.tsx 35–102 行）**

`src/components/tactics/useRosterSource.ts`：

```ts
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MEMBER_TYPE, playersApi } from "@/api/players";
import { matchEventsApi } from "@/api/matchLogs";
import type { RosterPlayer } from "@/lib/court";
import type { SquadOption, TacticsMode } from "./MatchEventSelector";

/** 賽事分隊時的隊別代碼，對應 MatchEventPlayer.ourSquad（見 MatchLogEdit 的分隊設定） */
export const SQUAD_KEYS = ["A", "B"] as const;

/**
 * 名單來源（戰術板、防守／接發站位共用）：全部現役球員，或某場賽事（＋隊別）的報名球員。
 * loadAllPlayers=false 時「all」模式不載入球員、roster 為 undefined
 * （站位頁的「位置代號」模式只顯示代號）。
 */
export function useRosterSource({ loadAllPlayers }: { loadAllPlayers: boolean }) {
  const [mode, setMode] = useState<TacticsMode>("all");
  const [eventId, setEventId] = useState<number | null>(null);
  // 賽事分成 A、B 兩隊時要排哪一隊；未分隊的賽事此值不生效（見 activeSquad）
  const [squad, setSquad] = useState<string>(SQUAD_KEYS[0]);

  const playersQuery = useQuery({
    queryKey: ["players", { activeOnly: true, memberType: MEMBER_TYPE.Player }],
    queryFn: () => playersApi.list({ activeOnly: true, memberType: MEMBER_TYPE.Player }),
    enabled: loadAllPlayers && mode === "all",
  });
  const eventsQuery = useQuery({
    queryKey: ["matchEvents"],
    queryFn: () => matchEventsApi.list(),
    enabled: mode !== "all",
  });

  const selectedEvent = useMemo(
    () => (eventId != null ? eventsQuery.data?.find((e) => e.id === eventId) : undefined),
    [eventsQuery.data, eventId],
  );

  const activeSquad = (selectedEvent?.squadCount ?? 1) >= 2 ? squad : null;

  const squadOptions = useMemo<SquadOption[]>(() => {
    if (activeSquad == null || !selectedEvent) return [];
    return SQUAD_KEYS.map((key) => ({
      key,
      count: selectedEvent.players.filter((p) => p.ourSquad === key).length,
    }));
  }, [activeSquad, selectedEvent]);

  // undefined = 載入中／尚未選賽事／站位頁的位置代號模式
  const roster = useMemo<RosterPlayer[] | undefined>(() => {
    if (mode === "all") {
      if (!loadAllPlayers) return undefined;
      return playersQuery.data?.map((p) => ({
        playerId: p.id,
        jerseyNo: p.jerseyNo,
        name: p.name,
        position: p.position,
      }));
    }
    return selectedEvent?.players
      // 分隊賽事只取該隊球員；報名了但未指定隊別者不屬於任何一隊
      .filter((p) => activeSquad == null || p.ourSquad === activeSquad)
      .map((p) => ({
        playerId: p.playerId,
        jerseyNo: p.jerseyNo,
        name: p.name,
        position: p.position,
      }));
  }, [mode, loadAllPlayers, playersQuery.data, selectedEvent, activeSquad]);

  const sourceKey =
    mode === "all"
      ? "all"
      : eventId == null
        ? "event:none"
        : activeSquad
          ? `event:${eventId}:${activeSquad}`
          : `event:${eventId}`;

  return {
    mode, setMode, eventId, setEventId, squad, setSquad,
    playersQuery, eventsQuery, selectedEvent, activeSquad, squadOptions, roster, sourceKey,
  };
}
```

- [ ] **Step 2: TacticsBoard 改用 hook**

`src/pages/TacticsBoard.tsx`：
1. 刪除 `const SQUAD_KEYS = ["A", "B"] as const;` 與其上方註解。
2. 刪除 `mode`／`eventId`／`squad` 三個 `useState`（含註解），刪除 `playersQuery`、`eventsQuery`、`selectedEvent`、`activeSquad`、`squadOptions`、`roster`、`sourceKey` 這段（原 53–112 行左右，到 `const board = useTacticsBoard(...)` 之前），在 `tool` state 之前改為：

```tsx
  const {
    mode, setMode, eventId, setEventId, squad, setSquad,
    playersQuery, eventsQuery, activeSquad, squadOptions, roster, sourceKey,
  } = useRosterSource({ loadAllPlayers: true });
```

3. import 增加 `import { SQUAD_KEYS, useRosterSource } from "@/components/tactics/useRosterSource";`；移除不再使用的 `useQuery`、`MEMBER_TYPE`、`playersApi`、`matchEventsApi`、`RosterPlayer`、`SquadOption`、`TacticsMode` import（以 `npm run lint` 為準）。保留原本「草稿依名單來源各自保存…」註解並移到 `useTacticsBoard(sourceKey, roster)` 上方。

- [ ] **Step 3: MatchEventSelector 支援 allLabel**

Props 介面加：

```ts
  /** 「all」選項的顯示文字；站位頁用「位置代號」 */
  allLabel?: string;
```

解構加 `allLabel`，渲染分段按鈕時：

```tsx
            {opt.value === "all" && allLabel ? allLabel : opt.label}
```

（取代原本的 `{opt.label}`。）

- [ ] **Step 4: 回歸測試**

Run: `npx vitest run src/pages/TacticsBoard.test.tsx` 與 `npm run lint`
Expected: PASS、0 錯誤。

- [ ] **Step 5: Commit**

```bash
git add src/components/tactics/useRosterSource.ts src/components/tactics/MatchEventSelector.tsx src/pages/TacticsBoard.tsx
git commit -m "抽出名單來源 hook 供戰術板與站位頁共用"
```

---

### Task 10: 半場元件 FormationCourt、球員挑選、陣容列、情況名稱對話框

**Files:**
- Create: `src/components/formations/FormationCourt.tsx`
- Create: `src/components/formations/SlotPlayerPicker.tsx`
- Create: `src/components/formations/FormationLineupBar.tsx`
- Create: `src/components/formations/SituationNameDialog.tsx`
- Test: `src/components/formations/FormationCourt.test.tsx`

**Interfaces:**
- Consumes: geometry、`roleTokenClass`、`useRosterSource` 回傳值、`MatchEventSelector`、`Dialog`
- Produces：
  - `interface CourtToken { key: string; role: string; primary: string; secondary?: string; point: Point }`
  - `FormationCourt({ tokens, ghosts?: Partial<Record<string, Point>>, violations?: ReadonlyArray<{ a: Point; b: Point }>, editable, onMove?(key, p), onTokenClick?(key), className? })`
  - `SlotPlayerPicker({ open, slotLabel, roster: RosterPlayer[], currentId: number | null, onPick(player: RosterPlayer | null), onClose })`
  - `FormationLineupBar({ source: ReturnType<typeof useRosterSource>, disabled? })`
  - `SituationNameDialog({ open, title, initial, onSubmit(name): string | null, onClose })`（onSubmit 回傳錯誤訊息或 null）

- [ ] **Step 1: 寫失敗測試**

`src/components/formations/FormationCourt.test.tsx`：

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FormationCourt, { type CourtToken } from "./FormationCourt";

const tokens: CourtToken[] = [
  { key: "S", role: "S", primary: "舉球", point: { x: 0.5, y: 0.1 } },
  { key: "L", role: "L", primary: "7", secondary: "小美", point: { x: 0.2, y: 0.6 } },
];

describe("FormationCourt", () => {
  it("依正規化座標定位 token", () => {
    render(<FormationCourt tokens={tokens} editable={false} />);
    const s = screen.getByRole("button", { name: "舉球" });
    expect(s.style.left).toBe("50%");
    expect(screen.getByRole("button", { name: "7 小美" })).toBeInTheDocument();
  });

  it("檢視模式點 token 觸發 onTokenClick", () => {
    const onTokenClick = vi.fn();
    render(<FormationCourt tokens={tokens} editable={false} onTokenClick={onTokenClick} />);
    fireEvent.click(screen.getByRole("button", { name: "舉球" }));
    expect(onTokenClick).toHaveBeenCalledWith("S");
  });

  it("有起始位置且有移動時畫箭頭；沒移動不畫", () => {
    const { container } = render(
      <FormationCourt
        tokens={tokens}
        editable={false}
        ghosts={{ S: { x: 0.5, y: 0.1 }, L: { x: 0.8, y: 0.6 } }}
      />,
    );
    expect(container.querySelectorAll("[data-arrow]")).toHaveLength(1);
  });

  it("位置錯誤畫紅線", () => {
    const { container } = render(
      <FormationCourt tokens={tokens} editable={false} violations={[{ a: tokens[0].point, b: tokens[1].point }]} />,
    );
    expect(container.querySelectorAll("[data-violation]")).toHaveLength(1);
  });

  it("編輯模式拖曳觸發 onMove，且座標不為 NaN", () => {
    const onMove = vi.fn();
    render(<FormationCourt tokens={tokens} editable onMove={onMove} />);
    const btn = screen.getByRole("button", { name: "舉球" });
    fireEvent.pointerDown(btn, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(btn, { pointerId: 1, clientX: 20, clientY: 20 });
    expect(onMove).toHaveBeenCalled();
    const [key, p] = onMove.mock.calls[0];
    expect(key).toBe("S");
    expect(Number.isNaN(p.x) || Number.isNaN(p.y)).toBe(false);
  });
});
```

Run: `npx vitest run src/components/formations/FormationCourt.test.tsx` → FAIL。

- [ ] **Step 2: 實作 FormationCourt**

```tsx
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { roleTokenClass } from "@/components/tactics/tokenStyle";
import {
  ATTACK_LINE_Y,
  END_LINE_Y,
  HALF_VIEW,
  fromContainerFraction,
  toPercent,
  toView,
  type Point,
} from "@/lib/formations/geometry";

export interface CourtToken {
  key: string;
  /** 位置代碼（OH/OPP/MB/S/L），決定配色 */
  role: string;
  /** 主文字：背號或位置代號 */
  primary: string;
  /** 副文字：球員姓名（未帶入陣容時省略） */
  secondary?: string;
  point: Point;
}

interface Props {
  tokens: CourtToken[];
  /** 起始位置（淡色虛線圈＋箭頭）；與目前位置幾乎相同者不畫 */
  ghosts?: Partial<Record<string, Point>>;
  violations?: ReadonlyArray<{ a: Point; b: Point }>;
  editable: boolean;
  onMove?: (key: string, p: Point) => void;
  onTokenClick?: (key: string) => void;
  className?: string;
}

const MOVED_EPS = 0.02;

/**
 * 我方半場（球網在上）＋球員 token。
 * 切換影格時 token 以 left/top transition（0.5s）滑到新位置；拖曳中關閉 transition 以免延遲。
 * 編輯模式才可拖曳（token 加 touch-none，場地空白處仍可捲動頁面）。
 */
export default function FormationCourt({
  tokens,
  ghosts,
  violations,
  editable,
  onMove,
  onTokenClick,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const pointFromEvent = (e: React.PointerEvent): Point | null => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return fromContainerFraction(0, 0);
    return fromContainerFraction((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const tl = toView({ x: 0, y: 0 });
  const br = toView({ x: 1, y: END_LINE_Y });
  const attackY = toView({ x: 0, y: ATTACK_LINE_Y }).y;

  return (
    <div
      ref={ref}
      className={cn("relative w-full select-none", className)}
      style={{ aspectRatio: `${HALF_VIEW.w} / ${HALF_VIEW.h}` }}
    >
      <svg
        viewBox={`0 0 ${HALF_VIEW.w} ${HALF_VIEW.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker id="formation-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-foreground/60" />
          </marker>
        </defs>
        <rect x={0} y={0} width={HALF_VIEW.w} height={HALF_VIEW.h} className="fill-muted/60" />
        <rect x={tl.x} y={tl.y} width={br.x - tl.x} height={br.y - tl.y} className="fill-primary/5 stroke-foreground/50" strokeWidth={6} />
        <line x1={tl.x} y1={attackY} x2={br.x} y2={attackY} className="stroke-foreground/35" strokeWidth={4} strokeDasharray="16 12" />
        {/* 球網 */}
        <line x1={0} y1={tl.y} x2={HALF_VIEW.w} y2={tl.y} className="stroke-foreground/70" strokeWidth={10} />

        {tokens.map((t) => {
          const g = ghosts?.[t.key];
          if (!g || Math.hypot(g.x - t.point.x, g.y - t.point.y) < MOVED_EPS) return null;
          const a = toView(g);
          const b = toView(t.point);
          return (
            <g key={`ghost-${t.key}`}>
              <circle cx={a.x} cy={a.y} r={30} className="fill-none stroke-foreground/40" strokeWidth={4} strokeDasharray="8 6" />
              <line
                data-arrow
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-foreground/60"
                strokeWidth={5}
                markerEnd="url(#formation-arrow)"
              />
            </g>
          );
        })}

        {violations?.map((v, i) => {
          const a = toView(v.a);
          const b = toView(v.b);
          return (
            <line key={`v-${i}`} data-violation x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-destructive" strokeWidth={8} />
          );
        })}
      </svg>

      {tokens.map((t) => {
        const pos = toPercent(t.point);
        const dragging = dragKey === t.key;
        const label = t.secondary ? `${t.primary} ${t.secondary}` : t.primary;
        return (
          <button
            key={t.key}
            type="button"
            aria-label={label}
            className={cn(
              "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full shadow-lift",
              roleTokenClass(t.role),
              editable ? "z-20 touch-none cursor-grab" : "z-10",
              dragging ? "z-30 scale-110 cursor-grabbing ring-2 ring-ring" : "transition-[left,top] duration-500 ease-in-out",
            )}
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            onClick={() => {
              if (!editable) onTokenClick?.(t.key);
            }}
            onPointerDown={(e) => {
              if (!editable) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDragKey(t.key);
            }}
            onPointerMove={(e) => {
              if (dragKey !== t.key) return;
              const p = pointFromEvent(e);
              if (p) onMove?.(t.key, p);
            }}
            onPointerUp={() => setDragKey(null)}
            onPointerCancel={() => setDragKey(null)}
          >
            <span className={cn("font-bold leading-none", t.secondary ? "text-sm tabular-nums" : "text-[11px]")}>
              {t.primary}
            </span>
            {t.secondary && (
              <span className="mt-0.5 max-w-[44px] truncate text-[10px] leading-none">{t.secondary}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

注意：測試中的拖曳案例，`setDragKey` 是 state，pointerMove 需在重新 render 後才看得到 `dragKey`。Testing Library 的 `fireEvent` 會包 `act`，兩次 fireEvent 之間已完成 render，故可通過；若失敗，改用 `useRef` 存 dragKey、同時保留 state 供樣式使用。

- [ ] **Step 3: 實作 SlotPlayerPicker**

```tsx
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { RosterPlayer } from "@/lib/court";
import { POSITION_LABELS, primaryPosition } from "@/lib/positions";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  slotLabel: string;
  roster: RosterPlayer[];
  currentId: number | null;
  onPick: (player: RosterPlayer | null) => void;
  onClose: () => void;
}

/** 替某個位置格子挑選球員（只影響顯示）；選到已在別格的球員時由呼叫端互換 */
export default function SlotPlayerPicker({ open, slotLabel, roster, currentId, onPick, onClose }: Props) {
  const sorted = [...roster].sort(
    (a, b) => (a.jerseyNo ?? Number.POSITIVE_INFINITY) - (b.jerseyNo ?? Number.POSITIVE_INFINITY),
  );
  return (
    <Dialog open={open} onClose={onClose} title={`選擇「${slotLabel}」的球員`} size="sm">
      <div className="max-h-[60dvh] space-y-1 overflow-y-auto p-4">
        {sorted.map((p) => {
          const pos = primaryPosition(p.position);
          return (
            <button
              key={p.playerId}
              type="button"
              onClick={() => onPick(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted",
                p.playerId === currentId && "bg-primary/10 font-semibold",
              )}
            >
              <span className="w-8 text-right tabular-nums">{p.jerseyNo ?? "–"}</span>
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">{pos ? POSITION_LABELS[pos] ?? pos : ""}</span>
            </button>
          );
        })}
        <Button variant="ghost" className="w-full" onClick={() => onPick(null)}>
          清除（顯示位置代號）
        </Button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: 實作 FormationLineupBar**

```tsx
import MatchEventSelector from "@/components/tactics/MatchEventSelector";
import { SQUAD_KEYS, type useRosterSource } from "@/components/tactics/useRosterSource";

interface Props {
  source: ReturnType<typeof useRosterSource>;
}

/** 站位頁的陣容列：預設「位置代號」，選了賽事（＋隊別）後可在場上點球員改選 */
export default function FormationLineupBar({ source }: Props) {
  return (
    <div className="space-y-1">
      <MatchEventSelector
        allLabel="位置代號"
        mode={source.mode}
        eventId={source.eventId}
        events={source.eventsQuery.data}
        eventsLoading={source.eventsQuery.isLoading}
        onModeChange={source.setMode}
        onEventChange={(id) => {
          source.setEventId(id);
          source.setSquad(SQUAD_KEYS[0]);
        }}
        squads={source.squadOptions}
        squad={source.activeSquad}
        onSquadChange={source.setSquad}
      />
      {source.roster && (
        <p className="text-xs text-muted-foreground">已依主要位置自動帶入球員，點場上球員可改選。</p>
      )}
    </div>
  );
}
```

（`type useRosterSource` 搭配 `ReturnType<typeof ...>` 需要值層級的 typeof；若 TS 報錯，改為 `import { SQUAD_KEYS, useRosterSource } from ...` 並只在型別位置使用 `typeof useRosterSource`。）

- [ ] **Step 5: 實作 SituationNameDialog**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SITUATION_NAME_MAX } from "@/lib/formations/layout";

interface Props {
  open: boolean;
  title: string;
  initial: string;
  /** 回傳錯誤訊息（顯示在欄位下方）或 null 表示成功、由呼叫端關閉 */
  onSubmit: (name: string) => string | null;
  onClose: () => void;
}

export default function SituationNameDialog({ open, title, initial, onSubmit, onClose }: Props) {
  // 以 key 重新掛載重置欄位（見呼叫端），此處只保存輸入中的值
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = () => setError(onSubmit(name));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={submit}>確定</Button>
        </>
      }
    >
      <div className="space-y-2 p-5">
        <Input
          autoFocus
          value={name}
          maxLength={SITUATION_NAME_MAX + 5}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          aria-label="情況名稱"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Dialog>
  );
}
```

（呼叫端以 `key={dialogKey}` 掛載，每次開啟遞增 key 以重置欄位；確認 `Dialog` 的 `footer` 渲染位置，見 `components/ui/dialog.tsx`。）

- [ ] **Step 6: 確認通過**：`npx vitest run src/components/formations` 與 `npm run lint` → PASS。

- [ ] **Step 7: Commit**

```bash
git add src/components/formations
git commit -m "新增站位半場元件、球員挑選、陣容列與情況名稱對話框"
```

---

### Task 11: 防守站位頁

**Files:**
- Create: `src/pages/DefenseFormation.tsx`
- Test: `src/pages/DefenseFormation.test.tsx`

**Interfaces:**
- Consumes: Task 4–10 全部
- Produces: `export default function DefenseFormationPage()`

- [ ] **Step 1: 寫失敗測試**

`src/pages/DefenseFormation.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formationsApi } from "@/api/formations";
import { confirmAction } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";
import DefenseFormationPage from "./DefenseFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});
vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return { ...actual, matchEventsApi: { ...actual.matchEventsApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock("@/lib/swal", async () => {
  const actual = await vi.importActual<typeof import("@/lib/swal")>("@/lib/swal");
  return { ...actual, confirmAction: vi.fn() };
});

function loginAs(permissions: string[]) {
  useAuthStore.setState({
    accessToken: "t",
    expiresAt: "2099-01-01T00:00:00Z",
    user: {
      id: 1, userName: "U", email: "u@example.com", roleId: 1, role: "Coach",
      permissions, allowedPages: ["defense", "receive"],
    },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DefenseFormationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(formationsApi.get).mockReset().mockResolvedValue({
    key: "defense", layout: null, version: 0, updatedAt: null, updatedByName: null,
  });
  vi.mocked(formationsApi.save).mockReset();
  vi.mocked(confirmAction).mockReset().mockResolvedValue({ isConfirmed: true } as never);
});

describe("防守站位頁", () => {
  it("無編輯權限：看得到預設情況、沒有編輯鈕、不顯示格式異常", async () => {
    loginAs([]);
    renderPage();
    expect(await screen.findByRole("button", { name: "對方打4號位" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "編輯" })).not.toBeInTheDocument();
    expect(screen.queryByText(/站位資料格式異常/)).not.toBeInTheDocument();
  });

  it("有權限才看得到編輯鈕", async () => {
    loginAs([PERM.FormationsEdit]);
    renderPage();
    expect(await screen.findByRole("button", { name: "編輯" })).toBeInTheDocument();
  });

  it("切換情況時球員移到新位置", async () => {
    loginAs([]);
    renderPage();
    const token = await screen.findByRole("button", { name: "主攻(前)" });
    const before = token.style.left;
    fireEvent.click(screen.getByRole("button", { name: "對方打4號位" }));
    expect(screen.getByRole("button", { name: "主攻(前)" }).style.left).not.toBe(before);
  });

  it("儲存遇到 409：顯示誰更新了，並保留編輯狀態", async () => {
    loginAs([PERM.FormationsEdit]);
    vi.mocked(formationsApi.save).mockRejectedValue({
      response: { status: 409, data: { message: "x", version: 2, updatedAt: "2026-10-19T00:00:00Z", updatedByName: "教練乙" } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("教練乙");
    expect(screen.getByRole("button", { name: "儲存" })).toBeInTheDocument();
  });

  it("刪除正在檢視的情況後回到基本站位", async () => {
    loginAs([PERM.FormationsEdit]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "編輯" }));
    fireEvent.click(screen.getByRole("button", { name: "對方吊球" }));
    fireEvent.click(screen.getByRole("button", { name: "刪除情況" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "對方吊球" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "基本站位" })).toHaveAttribute("aria-pressed", "true");
  });
});
```

Run: `npx vitest run src/pages/DefenseFormation.test.tsx` → FAIL。

- [ ] **Step 2: 共用頁首 FormationHeader**

兩個頁面共用的頁首（標題、最後更新、編輯／取消／儲存、衝突與格式異常提示、載入狀態）。建立 `src/components/formations/FormationHeader.tsx`：

```tsx
import type { ComponentType } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FormationDto } from "@/api/formations";
import type { useFormation } from "./useFormation";

type Formation = ReturnType<typeof useFormation<unknown>>;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" }) : "";

interface Props {
  title: string;
  icon: ComponentType<{ className?: string }>;
  formation: Pick<Formation, "editing" | "saving" | "conflict" | "recovered" | "updatedAt" | "updatedByName" | "startEdit" | "save" | "reload">;
  canEdit: boolean;
  /** 取消編輯（頁面負責有修改時的確認） */
  onCancel: () => void;
  /** 編輯中額外停用（例如接發頁切換體系時） */
  extra?: React.ReactNode;
}

function FormationHeader({ title, icon: Icon, formation: f, canEdit, onCancel, extra }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Icon className="h-5 w-5" />
            {title}
          </h1>
          {f.updatedAt && (
            <p className="text-xs text-muted-foreground">
              最後更新：{f.updatedByName ?? "—"} · {fmt(f.updatedAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {extra}
          {canEdit && !f.editing && <Button onClick={f.startEdit}>編輯</Button>}
          {f.editing && (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={f.saving}>取消</Button>
              <Button onClick={f.save} disabled={f.saving}>{f.saving ? "儲存中…" : "儲存"}</Button>
            </>
          )}
        </div>
      </div>

      {f.conflict && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="flex-1">
            站位已被 {f.conflict.updatedByName ?? "其他人"} 於 {fmt(f.conflict.updatedAt)} 更新。你的修改仍保留在畫面上，可先記下後重新載入。
          </span>
          <Button size="sm" variant="outline" onClick={() => void f.reload()}>
            重新載入（放棄我的修改）
          </Button>
        </div>
      )}

      {f.recovered && !f.editing && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          站位資料格式異常，已載入預設。
        </div>
      )}
    </div>
  );
}

function Loading({ title, query }: { title: string; query: UseQueryResult<FormationDto> }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {query.isError ? (
          <div className="flex items-center gap-2">
            <span>站位載入失敗。</span>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>重試</Button>
          </div>
        ) : (
          <span>載入中…</span>
        )}
      </CardContent>
    </Card>
  );
}

FormationHeader.Loading = Loading;
export default FormationHeader;
```

注意：
- `ReturnType<typeof useFormation<unknown>>` 需要 TS 4.7+ 的 instantiation expression（專案 TS 版本足夠）；若 lint/tsc 報錯，改為在 `useFormation.ts` 匯出 `export type FormationState<T> = ReturnType<typeof useFormation<T>>` 並在此引用。
- 若 `react-refresh/only-export-components` 對 `FormationHeader.Loading` 報錯，把 `Loading` 拆成獨立檔 `FormationLoading.tsx` 並在頁面直接 import（頁面中 `<FormationHeader.Loading …/>` 改成 `<FormationLoading …/>`）。
- 確認 `border-warning/40`、`bg-warning/10` 在 Tailwind 主題中存在（`tokenStyle.ts` 已使用 `bg-warning`）。

- [ ] **Step 3: 實作頁面**

`src/pages/DefenseFormation.tsx`：

```tsx
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, ShieldHalf, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormationCourt, { type CourtToken } from "@/components/formations/FormationCourt";
import FormationLineupBar from "@/components/formations/FormationLineupBar";
import SituationNameDialog from "@/components/formations/SituationNameDialog";
import SlotPlayerPicker from "@/components/formations/SlotPlayerPicker";
import { useFormation } from "@/components/formations/useFormation";
import { useRosterSource } from "@/components/tactics/useRosterSource";
import {
  DEFENSE_BASE_KEYS,
  DEFENSE_BASE_LABEL,
  parseDefenseLayout,
  SITUATION_NAME_MAX,
  type DefenseBaseKey,
} from "@/lib/formations/layout";
import { assignPlayer, autoAssign, clearSlot, type SlotAssignment } from "@/lib/formations/lineup";
import {
  addSituation,
  BASE_FRAME_ID,
  moveSituation,
  removeSituation,
  renameSituation,
  resetSituationFromBase,
  setDefensePoint,
} from "@/lib/formations/ops";
import { DEFENSE_SLOT_META, DEFENSE_SLOTS, type DefenseSlot } from "@/lib/formations/slots";
import { confirmAction } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { PERM, useAuthStore } from "@/stores/authStore";
import FormationHeader from "@/components/formations/FormationHeader";

const NAME_ERROR = `名稱需為 1–${SITUATION_NAME_MAX} 字`;

export default function DefenseFormationPage() {
  const canEdit = useAuthStore((s) => s.can)(PERM.FormationsEdit);
  const f = useFormation("defense", parseDefenseLayout);
  const source = useRosterSource({ loadAllPlayers: false });

  const [base, setBase] = useState<DefenseBaseKey>("setterFront");
  const [frameId, setFrameId] = useState<string>(BASE_FRAME_ID);
  const [pickSlot, setPickSlot] = useState<DefenseSlot | null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: "add" | "rename"; key: number } | null>(null);

  // 陣容：自動預填為派生值；手動改選依名單來源分開保存，換賽事不殘留
  const autoAssignment = useMemo<SlotAssignment<DefenseSlot>>(
    () => (source.roster ? autoAssign(DEFENSE_SLOTS, DEFENSE_SLOT_META, source.roster) : {}),
    [source.roster],
  );
  const [manual, setManual] = useState<{ key: string; value: SlotAssignment<DefenseSlot> } | null>(null);
  const assignment = manual?.key === source.sourceKey ? manual.value : autoAssignment;

  const layout = f.layout;
  if (!layout) {
    return <FormationHeader.Loading title="防守站位" query={f.query} />;
  }

  const situation = layout.situations.find((s) => s.id === frameId);
  // 目前情況被刪除時自動回到基本站位
  const activeId = situation ? situation.id : BASE_FRAME_ID;
  const frame = situation ? situation.positions[base] : layout.bases[base];
  const frameOrder = [BASE_FRAME_ID, ...layout.situations.map((s) => s.id)];
  const idx = frameOrder.indexOf(activeId);

  const tokens: CourtToken[] = DEFENSE_SLOTS.map((slot) => {
    const p = assignment[slot];
    return {
      key: slot,
      role: DEFENSE_SLOT_META[slot].position,
      primary: p ? String(p.jerseyNo ?? "–") : DEFENSE_SLOT_META[slot].label,
      secondary: p?.name,
      point: frame[slot],
    };
  });

  const handleDelete = async () => {
    if (!situation) return;
    const r = await confirmAction("刪除情況？", `確定要刪除「${situation.name}」嗎？儲存後才會生效。`, "刪除", true);
    if (!r.isConfirmed) return;
    f.update((l) => removeSituation(l, situation.id));
    setFrameId(BASE_FRAME_ID);
  };

  const handleReset = async () => {
    if (!situation) return;
    const r = await confirmAction(
      "從基本站位重新套用？",
      `「${situation.name}」的${DEFENSE_BASE_LABEL[base]}站位會被基本站位覆蓋。`,
      "套用",
    );
    if (r.isConfirmed) f.update((l) => resetSituationFromBase(l, situation.id, base));
  };

  const handleCancel = async () => {
    if (f.dirty) {
      const r = await confirmAction("放棄修改？", "尚未儲存的站位修改將會遺失。", "放棄", true);
      if (!r.isConfirmed) return;
    }
    f.cancel();
  };

  const frameButton = (id: string, name: string) => (
    <Button
      key={id}
      variant={activeId === id ? "default" : "ghost"}
      aria-pressed={activeId === id}
      className="w-full justify-start"
      onClick={() => setFrameId(id)}
    >
      {name}
    </Button>
  );

  return (
    <div className="space-y-4">
      <FormationHeader
        title="防守站位"
        icon={ShieldHalf}
        formation={f}
        canEdit={canEdit}
        onCancel={handleCancel}
      />

      <FormationLineupBar source={source} />

      <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:items-start xl:gap-6 xl:space-y-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">影格</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {DEFENSE_BASE_KEYS.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  className="flex-1"
                  variant={base === k ? "default" : "ghost"}
                  aria-pressed={base === k}
                  onClick={() => setBase(k)}
                >
                  {DEFENSE_BASE_LABEL[k]}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              {frameButton(BASE_FRAME_ID, "基本站位")}
              {layout.situations.map((s) => frameButton(s.id, s.name))}
            </div>

            {f.editing && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => setNameDialog({ mode: "add", key: Date.now() })}>
                  <Plus className="mr-1 h-4 w-4" />新增情況
                </Button>
                {situation && (
                  <>
                    <Button size="sm" variant="outline" aria-label="改名情況" onClick={() => setNameDialog({ mode: "rename", key: Date.now() })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="上移情況" onClick={() => f.update((l) => moveSituation(l, situation.id, -1))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="下移情況" onClick={() => f.update((l) => moveSituation(l, situation.id, 1))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="從基本站位重新套用" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="刪除情況" className="text-destructive" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="mx-auto max-w-md">
              <FormationCourt
                tokens={tokens}
                ghosts={situation ? layout.bases[base] : undefined}
                editable={f.editing}
                onMove={(slot, p) => f.update((l) => setDefensePoint(l, base, activeId, slot as DefenseSlot, p))}
                onTokenClick={source.roster ? (slot) => setPickSlot(slot as DefenseSlot) : undefined}
              />
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={idx <= 0} onClick={() => setFrameId(frameOrder[idx - 1])}>
                <ChevronLeft className="mr-1 h-4 w-4" />上一步
              </Button>
              <Button variant="outline" disabled={idx >= frameOrder.length - 1} onClick={() => setFrameId(frameOrder[idx + 1])}>
                下一步<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {f.editing && <p className={cn("text-center text-xs text-muted-foreground")}>拖曳球員調整「{situation?.name ?? "基本站位"}」的{DEFENSE_BASE_LABEL[base]}站位</p>}
          </CardContent>
        </Card>
      </div>

      {pickSlot && source.roster && (
        <SlotPlayerPicker
          open
          slotLabel={DEFENSE_SLOT_META[pickSlot].label}
          roster={source.roster}
          currentId={assignment[pickSlot]?.playerId ?? null}
          onPick={(player) => {
            setManual({
              key: source.sourceKey,
              value: player ? assignPlayer(assignment, pickSlot, player) : clearSlot(assignment, pickSlot),
            });
            setPickSlot(null);
          }}
          onClose={() => setPickSlot(null)}
        />
      )}

      {nameDialog && (
        <SituationNameDialog
          key={nameDialog.key}
          open
          title={nameDialog.mode === "add" ? "新增情況" : "改名情況"}
          initial={nameDialog.mode === "rename" ? situation?.name ?? "" : ""}
          onSubmit={(name) => {
            if (nameDialog.mode === "add") {
              const res = addSituation(layout, name);
              if (!res) return NAME_ERROR;
              f.update(() => res.layout);
              setFrameId(res.id);
            } else if (situation) {
              const next = renameSituation(layout, situation.id, name);
              if (!next) return NAME_ERROR;
              f.update(() => next);
            }
            setNameDialog(null);
            return null;
          }}
          onClose={() => setNameDialog(null)}
        />
      )}
    </div>
  );
}
```

注意：early return 必須在所有 hooks 之後（上面 `useMemo`、`useState` 皆在 `if (!layout)` 之前，符合 hooks 規則）。

- [ ] **Step 4: 確認通過**

Run: `npx vitest run src/pages/DefenseFormation.test.tsx` 與 `npm run lint`
Expected: PASS、0 錯誤。

- [ ] **Step 5: Commit**

```bash
git add src/pages/DefenseFormation.tsx src/pages/DefenseFormation.test.tsx src/components/formations/FormationHeader.tsx
git commit -m "新增防守站位頁"
```

---

### Task 12: 接發站位頁

**Files:**
- Create: `src/pages/ReceiveFormation.tsx`
- Test: `src/pages/ReceiveFormation.test.tsx`

**Interfaces:**
- Consumes: Task 4–11（含 `FormationHeader`）
- Produces: `export default function ReceiveFormationPage()`

- [ ] **Step 1: 寫失敗測試**

`src/pages/ReceiveFormation.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formationsApi, type FormationKey } from "@/api/formations";
import { defaultReceiveLayout } from "@/lib/formations/defaults";
import { useAuthStore } from "@/stores/authStore";
import ReceiveFormationPage from "./ReceiveFormation";

vi.mock("@/api/formations", async () => {
  const actual = await vi.importActual<typeof import("@/api/formations")>("@/api/formations");
  return { ...actual, formationsApi: { get: vi.fn(), save: vi.fn() } };
});
vi.mock("@/api/matchLogs", async () => {
  const actual = await vi.importActual<typeof import("@/api/matchLogs")>("@/api/matchLogs");
  return { ...actual, matchEventsApi: { ...actual.matchEventsApi, list: vi.fn().mockResolvedValue([]) } };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ReceiveFormationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    accessToken: "t",
    expiresAt: "2099-01-01T00:00:00Z",
    user: { id: 1, userName: "U", email: "u@example.com", roleId: 1, role: "Player", permissions: [], allowedPages: ["receive"] },
  });
  vi.mocked(formationsApi.get).mockReset().mockImplementation(async (key: FormationKey) => ({
    key, layout: null, version: 0, updatedAt: null, updatedByName: null,
  }));
});

describe("接發站位頁", () => {
  it("顯示輪轉標籤，R1 前排有攔中1、沒有攔中2", async () => {
    renderPage();
    expect(await screen.findByText("R1（舉球在3號位）")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "攔中1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "攔中2" })).not.toBeInTheDocument();
  });

  it("切到 R3：攔中1 由自由替換、改顯示攔中2", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "R3" }));
    expect(screen.getByRole("button", { name: "攔中2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "攔中1" })).not.toBeInTheDocument();
  });

  it("接發站位違規時列出說明；進攻位置影格不檢查", async () => {
    const l = defaultReceiveLayout("receive-opp");
    l.rotations[0].receive.OH1 = { x: 0.9, y: 0.08 };
    vi.mocked(formationsApi.get).mockImplementation(async (key: FormationKey) => ({
      key, layout: key === "receive-opp" ? l : null, version: key === "receive-opp" ? 1 : 0, updatedAt: null, updatedByName: null,
    }));
    renderPage();
    expect(await screen.findByText("4號位（主攻1）須在3號位（舉球）左側")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "進攻位置" }));
    expect(screen.queryByText("4號位（主攻1）須在3號位（舉球）左側")).not.toBeInTheDocument();
  });

  it("切換接發體系", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "2大砲＋自由" }));
    expect(screen.getByRole("button", { name: "2大砲＋自由" })).toHaveAttribute("aria-pressed", "true");
  });
});
```

注意：測試以 `name: "R3"` 找輪轉鈕，故輪轉按鈕的可及名稱為「R3」，完整標籤「R3（舉球在5號位）」另以文字顯示在場地上方。

Run: `npx vitest run src/pages/ReceiveFormation.test.tsx` → FAIL。

- [ ] **Step 2: 實作頁面**

`src/pages/ReceiveFormation.tsx`：

```tsx
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormationCourt, { type CourtToken } from "@/components/formations/FormationCourt";
import FormationHeader from "@/components/formations/FormationHeader";
import FormationLineupBar from "@/components/formations/FormationLineupBar";
import SlotPlayerPicker from "@/components/formations/SlotPlayerPicker";
import { useFormation } from "@/components/formations/useFormation";
import { useRosterSource } from "@/components/tactics/useRosterSource";
import { parseReceiveLayout, RECEIVE_SYSTEMS, type ReceiveFrameKey, type ReceiveSystem } from "@/lib/formations/layout";
import { assignPlayer, autoAssign, clearSlot, type SlotAssignment } from "@/lib/formations/lineup";
import { setReceivePoint } from "@/lib/formations/ops";
import { checkOverlap } from "@/lib/formations/overlap";
import {
  isSetterFrontRow,
  liberoReplaces,
  onCourtSlots,
  rotationLabel,
  ROTATIONS,
  type ReceiveSlot,
  type RotationNo,
} from "@/lib/formations/rotation";
import { RECEIVE_SLOT_META, RECEIVE_SLOTS } from "@/lib/formations/slots";
import { confirmAction } from "@/lib/swal";
import { PERM, useAuthStore } from "@/stores/authStore";

const parseOpp = (raw: unknown) => parseReceiveLayout(raw, "receive-opp");
const parse2oh = (raw: unknown) => parseReceiveLayout(raw, "receive-2oh");

const FRAME_LABEL: Record<ReceiveFrameKey, string> = { receive: "接發站位", attack: "進攻位置" };
const FRAME_KEYS: readonly ReceiveFrameKey[] = ["receive", "attack"];
/** 上一步／下一步的順序：R1 接發 → R1 進攻 → R2 接發 … */
const STEPS = ROTATIONS.flatMap((r) => FRAME_KEYS.map((k) => ({ rotation: r, frame: k })));

export default function ReceiveFormationPage() {
  const canEdit = useAuthStore((s) => s.can)(PERM.FormationsEdit);
  const fOpp = useFormation("receive-opp", parseOpp);
  const f2oh = useFormation("receive-2oh", parse2oh);
  const source = useRosterSource({ loadAllPlayers: false });

  const [system, setSystem] = useState<ReceiveSystem>("receive-opp");
  const [rotation, setRotation] = useState<RotationNo>(1);
  const [frameKey, setFrameKey] = useState<ReceiveFrameKey>("receive");
  const [pickSlot, setPickSlot] = useState<ReceiveSlot | null>(null);

  const autoAssignment = useMemo<SlotAssignment<ReceiveSlot>>(
    () => (source.roster ? autoAssign(RECEIVE_SLOTS, RECEIVE_SLOT_META, source.roster) : {}),
    [source.roster],
  );
  const [manual, setManual] = useState<{ key: string; value: SlotAssignment<ReceiveSlot> } | null>(null);
  const assignment = manual?.key === source.sourceKey ? manual.value : autoAssignment;

  const f = system === "receive-opp" ? fOpp : f2oh;
  const layout = f.layout;
  if (!layout) {
    return <FormationHeader.Loading title="接發站位" query={f.query} />;
  }

  const rot = layout.rotations[rotation - 1];
  const points = rot[frameKey];
  const fallback = { x: 0.5, y: 0.5 };
  const violations = frameKey === "receive" ? checkOverlap(rotation, points) : [];
  const stepIdx = STEPS.findIndex((s) => s.rotation === rotation && s.frame === frameKey);
  const goStep = (i: number) => {
    setRotation(STEPS[i].rotation);
    setFrameKey(STEPS[i].frame);
  };

  const tokens: CourtToken[] = onCourtSlots(rotation).map((slot) => {
    const p = assignment[slot];
    return {
      key: slot,
      role: RECEIVE_SLOT_META[slot].position,
      primary: p ? String(p.jerseyNo ?? "–") : RECEIVE_SLOT_META[slot].label,
      secondary: p?.name,
      point: points[slot] ?? fallback,
    };
  });

  const handleCancel = async () => {
    if (f.dirty) {
      const r = await confirmAction("放棄修改？", "尚未儲存的站位修改將會遺失。", "放棄", true);
      if (!r.isConfirmed) return;
    }
    f.cancel();
  };

  return (
    <div className="space-y-4">
      <FormationHeader title="接發站位" icon={Hand} formation={f} canEdit={canEdit} onCancel={handleCancel} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {RECEIVE_SYSTEMS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={system === s.key ? "default" : "ghost"}
              aria-pressed={system === s.key}
              // 編輯中不可切換體系，避免草稿與畫面對不上
              disabled={f.editing && system !== s.key}
              onClick={() => setSystem(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <FormationLineupBar source={source} />

      <div className="space-y-4 xl:grid xl:grid-cols-[2fr_3fr] xl:items-start xl:gap-6 xl:space-y-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">輪轉與影格</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-6 gap-1">
              {ROTATIONS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={rotation === r ? "default" : "outline"}
                  aria-pressed={rotation === r}
                  title={rotationLabel(r)}
                  onClick={() => setRotation(r)}
                >
                  R{r}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {FRAME_KEYS.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  className="flex-1"
                  variant={frameKey === k ? "default" : "ghost"}
                  aria-pressed={frameKey === k}
                  onClick={() => setFrameKey(k)}
                >
                  {FRAME_LABEL[k]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              舉球員{isSetterFrontRow(rotation) ? "前排" : "後排"}；自由替換{RECEIVE_SLOT_META[liberoReplaces(rotation)].label}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-center text-sm font-semibold">
              <span>{rotationLabel(rotation)}</span> · {FRAME_LABEL[frameKey]}
            </p>
            <div className="mx-auto max-w-md">
              <FormationCourt
                tokens={tokens}
                ghosts={frameKey === "attack" ? rot.receive : undefined}
                violations={violations.map((v) => ({ a: points[v.a] ?? fallback, b: points[v.b] ?? fallback }))}
                editable={f.editing}
                onMove={(slot, p) => f.update((l) => setReceivePoint(l, rotation, frameKey, slot as ReceiveSlot, p))}
                onTokenClick={source.roster ? (slot) => setPickSlot(slot as ReceiveSlot) : undefined}
              />
            </div>
            {violations.length > 0 && (
              <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {violations.map((v) => (
                  <li key={`${v.a}-${v.b}`}>{v.message}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" disabled={stepIdx <= 0} onClick={() => goStep(stepIdx - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />上一步
              </Button>
              <Button variant="outline" disabled={stepIdx >= STEPS.length - 1} onClick={() => goStep(stepIdx + 1)}>
                下一步<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {pickSlot && source.roster && (
        <SlotPlayerPicker
          open
          slotLabel={RECEIVE_SLOT_META[pickSlot].label}
          roster={source.roster}
          currentId={assignment[pickSlot]?.playerId ?? null}
          onPick={(player) => {
            setManual({
              key: source.sourceKey,
              value: player ? assignPlayer(assignment, pickSlot, player) : clearSlot(assignment, pickSlot),
            });
            setPickSlot(null);
          }}
          onClose={() => setPickSlot(null)}
        />
      )}
    </div>
  );
}
```

注意：輪轉按鈕的 `title` 會被 Testing Library 視為 description 而非 name，`getByRole("button", { name: "R3" })` 可正常找到。若 lint 規則禁止 `title` 作為唯一說明，保持現狀（名稱已是「R3」）。

- [ ] **Step 3: 確認通過**

Run: `npx vitest run src/pages/ReceiveFormation.test.tsx` 與 `npm run lint`
Expected: PASS、0 錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/pages/ReceiveFormation.tsx src/pages/ReceiveFormation.test.tsx
git commit -m "新增接發站位頁"
```

---

### Task 13: 路由、側欄、角色管理、CHANGELOG、完整驗證

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/config/nav.ts`
- Modify: `src/pages/AdminRoles.tsx`
- Modify: `docs/CHANGELOG.md`（repo 根目錄）

**Interfaces:**
- Consumes: Task 11、12 頁面、Task 4 常數

- [ ] **Step 1: 路由**

`App.tsx` import 區加：

```tsx
import DefenseFormationPage from '@/pages/DefenseFormation';
import ReceiveFormationPage from '@/pages/ReceiveFormation';
```

在 `/tactics` 的 `<Route element={<ProtectedRoute requirePage={PAGE.Tactics} />}>…</Route>` 之後加：

```tsx
              <Route element={<ProtectedRoute requirePage={PAGE.Defense} />}>
                <Route path="/defense" element={<DefenseFormationPage />} />
              </Route>
              <Route element={<ProtectedRoute requirePage={PAGE.Receive} />}>
                <Route path="/receive" element={<ReceiveFormationPage />} />
              </Route>
```

- [ ] **Step 2: 側欄**

`nav.ts` 的 lucide import 加入 `Hand`、`ShieldHalf`（依字母序），在「戰術板」項目之後加：

```ts
  {
    to: "/defense",
    label: "防守站位",
    page: PAGE.Defense,
    icon: ShieldHalf,
    group: "main",
  },
  {
    to: "/receive",
    label: "接發站位",
    page: PAGE.Receive,
    icon: Hand,
    group: "main",
  },
```

- [ ] **Step 3: 角色管理**

`AdminRoles.tsx`：lucide import 加入 `Hand`、`ShieldHalf`。`PAGE_META` 在 `MatchLogs` 那行之後加：

```ts
  { key: PAGE.Defense,     label: "防守站位",     icon: ShieldHalf },
  { key: PAGE.Receive,     label: "接發站位",     icon: Hand },
```

`EDIT_PERMS` 最後加：

```ts
  { key: PERM.FormationsEdit, label: "站位編輯", icon: ShieldHalf, desc: "修改並儲存全隊共用的防守／接發站位", relatedPage: PAGE.Defense },
```

（`relatedPage` 只能填一個；勾選「站位編輯」會自動勾上防守站位頁。接發站位頁需另外勾選——兩頁預設本來就隨 tactics 一起開放，影響有限。）

- [ ] **Step 4: CHANGELOG**

`docs/CHANGELOG.md` 在第一個 `## [2026-06-12]` 之前插入：

```markdown
## [2026-10-19]

### 新增
- **防守站位**（`/defense`）
  - 全隊共用的防守體系：「舉球員前排／後排」兩組基本站位，加上自訂情況（預設：對方打4號位、對方打2號位、對方中間快攻、對方吊球、機會球）。
  - 點選情況時球員以動畫從基本站位滑到新位置，並以淡色圈與箭頭標示移動方向；可用「上一步／下一步」逐格講解。
- **接發站位**（`/receive`）
  - 兩套接發體系：「舉對＋自由＋1大砲」「2大砲＋自由」；每套 R1–R6，各有「接發站位 → 進攻位置」兩個影格。
  - 接發站位違反位置錯誤（overlap）規則時以紅線與文字警示（不阻擋儲存）。
- 兩頁皆可帶入賽事（含 A/B 隊）陣容：依主要位置自動填入球員，點場上球員可改選；未選賽事時顯示位置代號。
- 站位存於資料庫、跨裝置共用；編輯需「站位編輯」權限（預設：管理員、教練、隊長、副隊長），兩人同時編輯時後存者會收到衝突提示，不會互相覆蓋。

### 技術
- 新增資料表 `"Formations"`（增量腳本 `Data/Sql/2026-10-19_AddFormations.sql`，部署時需於正式 DB 執行）。
- 戰術板名單來源邏輯抽出為 `useRosterSource`，供站位頁共用。

---

```

- [ ] **Step 5: 完整驗證**

client 目錄：

```bash
npm run lint
npm test
npm run build
```

repo 根目錄：

```bash
dotnet build VolleyballTrainingTracker.Server/VolleyballTrainingTracker.Server.csproj -p:BuildClient=false
dotnet test VolleyballTrainingTracker.Server.Tests/VolleyballTrainingTracker.Server.Tests.csproj -p:BuildClient=false
```

Expected: 全部成功、0 錯誤、0 失敗。任一失敗先修正再繼續。

- [ ] **Step 6: 手動驗證（本機 PG17＋後端＋前端）**

1. 對本機 DB 執行 `2026-10-19_AddFormations.sql`（Task 2 Step 6）。
2. 啟動後端與前端（見 README.md）；以 YUANHE（Admin）登入。
3. 防守站位：按「編輯」→ 拖動一位球員 → 「儲存」→ 重新整理，位置保留；`SELECT "Key","Version" FROM "Formations";` 顯示 `defense | 1`。
4. 衝突：開兩個分頁都進入編輯，A 儲存成功後 B 儲存 → B 顯示「站位已被 … 更新」提示，DB `Version` 為 2（不是 3）。
5. 權限：以 Player 角色帳號登入 → 看得到兩頁、沒有「編輯」鈕；用 curl／`.http` 對 `PUT /api/formations/defense` → 403。
6. `GET /api/formations/xyz` → 404。
7. 接發站位：切到 R3、R4 檢查攔中與自由替換；把 R1 主攻1 拖到舉球右邊 → 出現紅線與說明。
8. 有未儲存修改時點側欄其他頁 → 出現確認框；取消則留在本頁。

無法在本機執行的項目，於交付說明中列為「待手動驗證」。

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/config/nav.ts src/pages/AdminRoles.tsx ../docs/CHANGELOG.md
git commit -m "接上防守／接發站位路由、側欄與角色管理，更新 CHANGELOG"
```

---

## 交付說明（給 Codex 覆核）

完成後列出：
- 改動檔案清單（後端 9 個、前端約 25 個、SQL 2 個、文件 1 個）。
- 部署注意：正式 DB（Supabase）需手動執行 `2026-10-19_AddFormations.sql`；seed-roles 不會更新既有角色。
- 已知限制：瀏覽器「上一頁」不受未儲存保護（BrowserRouter 無 useBlocker）；第一版不提供自訂輪轉順序、多套防守方案、自動連續播放、匯出。
