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
