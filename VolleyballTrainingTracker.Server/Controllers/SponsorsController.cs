using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 隊費贊助榜：看／編分離。
/// 讀取（芳名榜、名冊、紀錄）以 [RequirePage(Pages.Sponsors)] 控管；
/// 新增/修改/刪除額外要求 [RequirePermission(Permissions.SponsorsEdit)]（金錢較敏感）。
/// 贊助者以名冊（Sponsor）為單位，可連結球員或為陣容外人士，確保多次贊助正確累計。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.Sponsors)]
[Route("api/sponsors")]
public class SponsorsController : ControllerBase
{
    private readonly AppDbContext _db;
    public SponsorsController(AppDbContext db) => _db = db;

    // =========================================================================
    // 贊助者名冊
    // =========================================================================

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SponsorDto>>> ListSponsors()
    {
        var list = await _db.Sponsors
            .Select(s => new SponsorDto
            {
                Id = s.Id,
                PlayerId = s.PlayerId,
                DisplayName = s.DisplayName,
                Identity = s.Identity,
                Notes = s.Notes,
                JerseyNo = s.Player != null ? s.Player.JerseyNo : null,
                TotalAmount = s.Sponsorships.Sum(x => (int?)x.Amount) ?? 0,
                Count = s.Sponsorships.Count,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                UpdatedByName = s.UpdatedByUser != null
                    ? (s.UpdatedByUser.DisplayName ?? s.UpdatedByUser.UserName)
                    : null,
            })
            .ToListAsync();

        // 依累計金額排序（金額相同時依名稱），於記憶體排序避免對相關子查詢欄位排序
        var ordered = list
            .OrderByDescending(s => s.TotalAmount)
            .ThenBy(s => s.DisplayName, StringComparer.Ordinal)
            .ToList();
        return Ok(ordered);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SponsorDto>> GetSponsor(int id)
    {
        var dto = await LoadSponsorDtoAsync(id);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<ActionResult<SponsorDto>> CreateSponsor([FromBody] SponsorUpsertRequest req)
    {
        var err = await ValidateSponsorAsync(req, null);
        if (err != null) return BadRequest(new { message = err });

        var sponsor = new Sponsor
        {
            PlayerId = req.PlayerId,
            DisplayName = req.DisplayName.Trim(),
            Identity = req.Identity,
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
        };
        _db.Sponsors.Add(sponsor);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSponsor), new { id = sponsor.Id }, await LoadSponsorDtoAsync(sponsor.Id));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<ActionResult<SponsorDto>> UpdateSponsor(int id, [FromBody] SponsorUpsertRequest req)
    {
        var sponsor = await _db.Sponsors.FindAsync(id);
        if (sponsor == null) return NotFound();

        var err = await ValidateSponsorAsync(req, id);
        if (err != null) return BadRequest(new { message = err });

        sponsor.PlayerId = req.PlayerId;
        sponsor.DisplayName = req.DisplayName.Trim();
        sponsor.Identity = req.Identity;
        sponsor.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
        await _db.SaveChangesAsync();

        return Ok(await LoadSponsorDtoAsync(id));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<IActionResult> DeleteSponsor(int id)
    {
        var sponsor = await _db.Sponsors.FindAsync(id);
        if (sponsor == null) return NotFound();

        var hasRecords = await _db.Sponsorships.AnyAsync(x => x.SponsorId == id);
        if (hasRecords)
            return BadRequest(new { message = "此贊助者仍有贊助紀錄，請先刪除其紀錄後再刪除名冊" });

        _db.Sponsors.Remove(sponsor);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // =========================================================================
    // 贊助紀錄
    // =========================================================================

    [HttpGet("sponsorships")]
    public async Task<ActionResult<IEnumerable<SponsorshipDto>>> ListSponsorships(
        [FromQuery] int? sponsorId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var q = _db.Sponsorships
            .Include(x => x.Sponsor).ThenInclude(s => s!.Player)
            .Include(x => x.UpdatedByUser)
            .AsQueryable();

        if (sponsorId.HasValue) q = q.Where(x => x.SponsorId == sponsorId.Value);
        if (from.HasValue) q = q.Where(x => x.OccurredAt >= from.Value.Date);
        if (to.HasValue) q = q.Where(x => x.OccurredAt <= to.Value.Date);

        var list = await q
            .OrderByDescending(x => x.OccurredAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync();

        return Ok(list.Select(ToSponsorshipDto));
    }

    [HttpPost("sponsorships")]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<ActionResult<SponsorshipDto>> CreateSponsorship([FromBody] SponsorshipUpsertRequest req)
    {
        var err = await ValidateSponsorshipAsync(req);
        if (err != null) return BadRequest(new { message = err });

        var entity = new Sponsorship
        {
            SponsorId = req.SponsorId,
            Amount = req.Amount,
            OccurredAt = DateTime.SpecifyKind(req.OccurredAt.Date, DateTimeKind.Utc),
            Purpose = string.IsNullOrWhiteSpace(req.Purpose) ? null : req.Purpose.Trim(),
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
        };
        _db.Sponsorships.Add(entity);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ListSponsorships), new { sponsorId = entity.SponsorId },
            await LoadSponsorshipDtoAsync(entity.Id));
    }

    [HttpPut("sponsorships/{id:int}")]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<ActionResult<SponsorshipDto>> UpdateSponsorship(int id, [FromBody] SponsorshipUpsertRequest req)
    {
        var entity = await _db.Sponsorships.FindAsync(id);
        if (entity == null) return NotFound();

        var err = await ValidateSponsorshipAsync(req);
        if (err != null) return BadRequest(new { message = err });

        entity.SponsorId = req.SponsorId;
        entity.Amount = req.Amount;
        entity.OccurredAt = DateTime.SpecifyKind(req.OccurredAt.Date, DateTimeKind.Utc);
        entity.Purpose = string.IsNullOrWhiteSpace(req.Purpose) ? null : req.Purpose.Trim();
        entity.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
        await _db.SaveChangesAsync();

        return Ok(await LoadSponsorshipDtoAsync(id));
    }

    [HttpDelete("sponsorships/{id:int}")]
    [RequirePermission(Permissions.SponsorsEdit)]
    public async Task<IActionResult> DeleteSponsorship(int id)
    {
        var entity = await _db.Sponsorships.FindAsync(id);
        if (entity == null) return NotFound();
        _db.Sponsorships.Remove(entity);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // =========================================================================
    // 統計（總額 / 筆數 / 人數 / 芳名榜 / 常用用途）
    // =========================================================================

    [HttpGet("stats")]
    public async Task<ActionResult<SponsorStatsDto>> Stats(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int top = 10)
    {
        if (top <= 0 || top > 50) top = 10;

        var q = _db.Sponsorships.AsQueryable();
        if (from.HasValue) q = q.Where(x => x.OccurredAt >= from.Value.Date);
        if (to.HasValue) q = q.Where(x => x.OccurredAt <= to.Value.Date);

        // 先以 SponsorId 聚合，再到名冊補顯示資訊（避免對巢狀導覽屬性 group by 的翻譯問題）
        var agg = await q
            .GroupBy(x => x.SponsorId)
            .Select(g => new
            {
                SponsorId = g.Key,
                TotalAmount = g.Sum(x => x.Amount),
                Count = g.Count(),
            })
            .ToListAsync();

        var sponsorIds = agg.Select(a => a.SponsorId).ToList();
        var infoById = (await _db.Sponsors
                .Where(s => sponsorIds.Contains(s.Id))
                .Select(s => new
                {
                    s.Id,
                    s.DisplayName,
                    s.Identity,
                    JerseyNo = s.Player != null ? s.Player.JerseyNo : (int?)null,
                })
                .ToListAsync())
            .ToDictionary(s => s.Id);

        var topSponsors = agg
            .Select(a =>
            {
                infoById.TryGetValue(a.SponsorId, out var info);
                return new SponsorRankDto
                {
                    SponsorId = a.SponsorId,
                    DisplayName = info?.DisplayName ?? string.Empty,
                    Identity = info?.Identity ?? 4,
                    JerseyNo = info?.JerseyNo,
                    TotalAmount = a.TotalAmount,
                    Count = a.Count,
                };
            })
            .OrderByDescending(x => x.TotalAmount)
            .ThenBy(x => x.DisplayName, StringComparer.Ordinal)
            .Take(top)
            .ToList();

        var recentPurposes = await _db.Sponsorships
            .Where(x => x.Purpose != null)
            .OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id)
            .Select(x => x.Purpose!)
            .Take(50)
            .ToListAsync();
        var distinctPurposes = recentPurposes
            .Select(p => p.Trim())
            .Where(p => p.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .Take(5)
            .ToList();

        return Ok(new SponsorStatsDto
        {
            TotalAmount = agg.Sum(a => a.TotalAmount),
            TotalCount = agg.Sum(a => a.Count),
            SponsorCount = agg.Count,
            TopSponsors = topSponsors,
            RecentPurposes = distinctPurposes,
        });
    }

    // =========================================================================
    // helpers
    // =========================================================================

    private async Task<string?> ValidateSponsorAsync(SponsorUpsertRequest req, int? selfId)
    {
        if (string.IsNullOrWhiteSpace(req.DisplayName))
            return "顯示名稱為必填";
        if (req.Identity is < 0 or > 4)
            return "身分不合法";

        if (req.PlayerId.HasValue)
        {
            var playerExists = await _db.Players.AnyAsync(p => p.Id == req.PlayerId.Value);
            if (!playerExists) return "找不到所連結的人員";

            var dup = await _db.Sponsors.AnyAsync(s =>
                s.PlayerId == req.PlayerId.Value && (selfId == null || s.Id != selfId.Value));
            if (dup) return "該人員已在贊助者名冊中，請直接編輯既有項目";
        }
        return null;
    }

    private async Task<string?> ValidateSponsorshipAsync(SponsorshipUpsertRequest req)
    {
        if (req.Amount <= 0) return "金額需為正整數";
        var sponsorExists = await _db.Sponsors.AnyAsync(s => s.Id == req.SponsorId);
        if (!sponsorExists) return "找不到贊助者，請先建立贊助者名冊";
        return null;
    }

    private async Task<SponsorDto?> LoadSponsorDtoAsync(int id)
    {
        return await _db.Sponsors
            .Where(s => s.Id == id)
            .Select(s => new SponsorDto
            {
                Id = s.Id,
                PlayerId = s.PlayerId,
                DisplayName = s.DisplayName,
                Identity = s.Identity,
                Notes = s.Notes,
                JerseyNo = s.Player != null ? s.Player.JerseyNo : null,
                TotalAmount = s.Sponsorships.Sum(x => (int?)x.Amount) ?? 0,
                Count = s.Sponsorships.Count,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                UpdatedByName = s.UpdatedByUser != null
                    ? (s.UpdatedByUser.DisplayName ?? s.UpdatedByUser.UserName)
                    : null,
            })
            .FirstOrDefaultAsync();
    }

    private async Task<SponsorshipDto?> LoadSponsorshipDtoAsync(int id)
    {
        var x = await _db.Sponsorships
            .Include(s => s.Sponsor).ThenInclude(s => s!.Player)
            .Include(s => s.UpdatedByUser)
            .FirstOrDefaultAsync(s => s.Id == id);
        return x == null ? null : ToSponsorshipDto(x);
    }

    private static SponsorshipDto ToSponsorshipDto(Sponsorship x) => new()
    {
        Id = x.Id,
        SponsorId = x.SponsorId,
        SponsorName = x.Sponsor?.DisplayName ?? string.Empty,
        SponsorIdentity = x.Sponsor?.Identity ?? 4,
        SponsorJerseyNo = x.Sponsor?.Player?.JerseyNo,
        Amount = x.Amount,
        OccurredAt = x.OccurredAt,
        Purpose = x.Purpose,
        Notes = x.Notes,
        CreatedAt = x.CreatedAt,
        UpdatedAt = x.UpdatedAt,
        UpdatedByName = x.UpdatedByUser != null
            ? (x.UpdatedByUser.DisplayName ?? x.UpdatedByUser.UserName)
            : null,
    };
}
