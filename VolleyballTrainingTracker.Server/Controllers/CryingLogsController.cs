using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 哭哭榜：可看就可編。所有端點以 [RequirePage("crying")] 控管，
/// 不另外切 perm.* 顆粒（與專案其他資源不同，刻意設計）。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.Crying)]
[Route("api/crying-logs")]
public class CryingLogsController : ControllerBase
{
    private const string KindPlayer = "player";
    private const string KindExternal = "external";

    private readonly AppDbContext _db;
    public CryingLogsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CryingLogDto>>> List(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? crierId = null,
        [FromQuery] int? culpritId = null,
        [FromQuery] string? culpritName = null)
    {
        var q = _db.CryingLogs
            .Include(x => x.Crier)
            .Include(x => x.UpdatedByUser)
            .Include(x => x.Culprits).ThenInclude(c => c.Player)
            .AsQueryable();

        if (from.HasValue) q = q.Where(x => x.OccurredAt >= from.Value.Date);
        if (to.HasValue) q = q.Where(x => x.OccurredAt <= to.Value.Date);
        if (crierId.HasValue) q = q.Where(x => x.CrierPlayerId == crierId.Value);
        if (culpritId.HasValue) q = q.Where(x => x.Culprits.Any(c => c.PlayerId == culpritId.Value));
        if (!string.IsNullOrWhiteSpace(culpritName))
        {
            var name = culpritName.Trim();
            q = q.Where(x => x.Culprits.Any(c => c.ExternalName == name));
        }

        var list = await q
            .OrderByDescending(x => x.OccurredAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync();

        return Ok(list.Select(ToDto));
    }

    /// <summary>
    /// 清單篩選下拉的選項：來源為「實際出現在紀錄中的人」（含已離隊/畢業球員與外部加分者），
    /// 不受日期或其他篩選影響。
    /// </summary>
    [HttpGet("filter-options")]
    public async Task<ActionResult<CryingFilterOptionsDto>> FilterOptions()
    {
        var criers = await _db.CryingLogs
            .Select(x => new { x.CrierPlayerId, x.Crier!.Name, x.Crier!.JerseyNo })
            .Distinct()
            .ToListAsync();

        var scorerPlayers = await _db.CryingLogCulprits
            .Where(c => c.PlayerId != null)
            .Select(c => new { PlayerId = c.PlayerId!.Value, c.Player!.Name, c.Player!.JerseyNo })
            .Distinct()
            .ToListAsync();

        var scorerExternals = await _db.CryingLogCulprits
            .Where(c => c.ExternalName != null)
            .Select(c => c.ExternalName!)
            .Distinct()
            .ToListAsync();

        var result = new CryingFilterOptionsDto
        {
            Criers = criers
                .OrderBy(c => c.JerseyNo ?? int.MaxValue)
                .ThenBy(c => c.Name, StringComparer.Ordinal)
                .Select(c => new CryingCrierRefDto
                {
                    PlayerId = c.CrierPlayerId,
                    Name = c.Name,
                    JerseyNo = c.JerseyNo,
                })
                .ToList(),
            Scorers = scorerPlayers
                .OrderBy(c => c.JerseyNo ?? int.MaxValue)
                .ThenBy(c => c.Name, StringComparer.Ordinal)
                .Select(c => new CryingScorerRefDto
                {
                    Kind = KindPlayer,
                    PlayerId = c.PlayerId,
                    Name = c.Name,
                    JerseyNo = c.JerseyNo,
                })
                .Concat(scorerExternals
                    .OrderBy(n => n, StringComparer.Ordinal)
                    .Select(n => new CryingScorerRefDto
                    {
                        Kind = KindExternal,
                        PlayerId = null,
                        Name = n,
                        JerseyNo = null,
                    }))
                .ToList(),
        };

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CryingLogDto>> Get(int id)
    {
        var log = await _db.CryingLogs
            .Include(x => x.Crier)
            .Include(x => x.UpdatedByUser)
            .Include(x => x.Culprits).ThenInclude(c => c.Player)
            .FirstOrDefaultAsync(x => x.Id == id);
        return log == null ? NotFound() : Ok(ToDto(log));
    }

    [HttpPost]
    public async Task<ActionResult<CryingLogDto>> Create([FromBody] CryingLogUpsertRequest req)
    {
        var err = await ValidateAsync(req);
        if (err != null) return BadRequest(new { message = err });

        var log = new CryingLog
        {
            OccurredAt = DateTime.SpecifyKind(req.OccurredAt.Date, DateTimeKind.Utc),
            CrierPlayerId = req.CrierPlayerId,
            Reason = req.Reason.Trim(),
            Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
        };
        foreach (var pid in NormalizePlayerIds(req.ScorerPlayerIds, req.CrierPlayerId))
            log.Culprits.Add(new CryingLogCulprit { PlayerId = pid });
        foreach (var name in NormalizeExternalNames(req.ScorerExternalNames))
            log.Culprits.Add(new CryingLogCulprit { ExternalName = name });

        _db.CryingLogs.Add(log);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = log.Id }, await LoadDtoAsync(log.Id));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CryingLogDto>> Update(int id, [FromBody] CryingLogUpsertRequest req)
    {
        var log = await _db.CryingLogs
            .Include(x => x.Culprits)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (log == null) return NotFound();

        var err = await ValidateAsync(req);
        if (err != null) return BadRequest(new { message = err });

        log.OccurredAt = DateTime.SpecifyKind(req.OccurredAt.Date, DateTimeKind.Utc);
        log.CrierPlayerId = req.CrierPlayerId;
        log.Reason = req.Reason.Trim();
        log.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();

        var wantPlayerIds = NormalizePlayerIds(req.ScorerPlayerIds, req.CrierPlayerId).ToHashSet();
        var wantExternals = NormalizeExternalNames(req.ScorerExternalNames).ToHashSet(StringComparer.Ordinal);

        // 移除不再保留的（球員 or 外部）
        foreach (var c in log.Culprits.ToList())
        {
            var keep = c.PlayerId.HasValue
                ? wantPlayerIds.Contains(c.PlayerId.Value)
                : (c.ExternalName != null && wantExternals.Contains(c.ExternalName));
            if (!keep) _db.CryingLogCulprits.Remove(c);
        }

        var havePlayerIds = log.Culprits.Where(c => c.PlayerId.HasValue).Select(c => c.PlayerId!.Value).ToHashSet();
        var haveExternals = log.Culprits.Where(c => c.ExternalName != null).Select(c => c.ExternalName!).ToHashSet(StringComparer.Ordinal);

        foreach (var pid in wantPlayerIds.Where(p => !havePlayerIds.Contains(p)))
            log.Culprits.Add(new CryingLogCulprit { PlayerId = pid });
        foreach (var name in wantExternals.Where(n => !haveExternals.Contains(n)))
            log.Culprits.Add(new CryingLogCulprit { ExternalName = name });

        await _db.SaveChangesAsync();
        return Ok(await LoadDtoAsync(log.Id));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var log = await _db.CryingLogs.FindAsync(id);
        if (log == null) return NotFound();
        _db.CryingLogs.Remove(log);  // cascade 帶走 Culprits
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("stats")]
    public async Task<ActionResult<CryingStatsDto>> Stats(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int top = 10)
    {
        if (top <= 0 || top > 50) top = 10;

        var q = _db.CryingLogs.AsQueryable();
        if (from.HasValue) q = q.Where(x => x.OccurredAt >= from.Value.Date);
        if (to.HasValue) q = q.Where(x => x.OccurredAt <= to.Value.Date);

        var totalLogs = await q.CountAsync();

        var topCriers = await q
            .GroupBy(x => new { x.CrierPlayerId, x.Crier!.Name, x.Crier!.JerseyNo })
            .Select(g => new CryingPlayerRankDto
            {
                Kind = KindPlayer,
                PlayerId = g.Key.CrierPlayerId,
                Name = g.Key.Name,
                JerseyNo = g.Key.JerseyNo,
                Count = g.Count(),
            })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .Take(top)
            .ToListAsync();

        // 加分者統計：球員 / 外部分開算，再合併排序
        var scorerPlayerRows = await q.SelectMany(x => x.Culprits
                .Where(c => c.PlayerId != null)
                .Select(c => new
                {
                    c.PlayerId,
                    PlayerName = c.Player!.Name,
                    c.Player!.JerseyNo,
                    CryingLogId = x.Id,
                }))
            .GroupBy(r => new { r.PlayerId, r.PlayerName, r.JerseyNo })
            .Select(g => new CryingPlayerRankDto
            {
                Kind = KindPlayer,
                PlayerId = g.Key.PlayerId,
                Name = g.Key.PlayerName,
                JerseyNo = g.Key.JerseyNo,
                Count = g.Select(x => x.CryingLogId).Distinct().Count(),
            })
            .ToListAsync();

        var scorerExternalRows = await q.SelectMany(x => x.Culprits
                .Where(c => c.ExternalName != null)
                .Select(c => new
                {
                    c.ExternalName,
                    CryingLogId = x.Id,
                }))
            .GroupBy(r => r.ExternalName!)
            .Select(g => new CryingPlayerRankDto
            {
                Kind = KindExternal,
                PlayerId = null,
                Name = g.Key,
                JerseyNo = null,
                Count = g.Select(x => x.CryingLogId).Distinct().Count(),
            })
            .ToListAsync();

        var topScorers = scorerPlayerRows.Concat(scorerExternalRows)
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .Take(top)
            .ToList();

        // 經典組合：哭者一定是球員；加分者球員 / 外部分開 group 再合併
        var pairPlayerRows = await q.SelectMany(x => x.Culprits
                .Where(c => c.PlayerId != null)
                .Select(c => new
                {
                    CrierId = x.CrierPlayerId,
                    CrierName = x.Crier!.Name,
                    ScorerId = c.PlayerId,
                    ScorerName = c.Player!.Name,
                }))
            .GroupBy(r => new { r.CrierId, r.CrierName, r.ScorerId, r.ScorerName })
            .Select(g => new CryingPairRankDto
            {
                CrierId = g.Key.CrierId,
                CrierName = g.Key.CrierName,
                ScorerKind = KindPlayer,
                ScorerId = g.Key.ScorerId,
                ScorerName = g.Key.ScorerName,
                Count = g.Count(),
            })
            .ToListAsync();

        var pairExternalRows = await q.SelectMany(x => x.Culprits
                .Where(c => c.ExternalName != null)
                .Select(c => new
                {
                    CrierId = x.CrierPlayerId,
                    CrierName = x.Crier!.Name,
                    ScorerName = c.ExternalName!,
                }))
            .GroupBy(r => new { r.CrierId, r.CrierName, r.ScorerName })
            .Select(g => new CryingPairRankDto
            {
                CrierId = g.Key.CrierId,
                CrierName = g.Key.CrierName,
                ScorerKind = KindExternal,
                ScorerId = null,
                ScorerName = g.Key.ScorerName,
                Count = g.Count(),
            })
            .ToListAsync();

        var topPairs = pairPlayerRows.Concat(pairExternalRows)
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.CrierName)
            .Take(top)
            .ToList();

        var recentReasons = await _db.CryingLogs
            .OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id)
            .Select(x => x.Reason)
            .Take(50)
            .ToListAsync();
        var distinctRecent = recentReasons
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct(StringComparer.Ordinal)
            .Take(5)
            .ToList();

        return Ok(new CryingStatsDto
        {
            TotalLogs = totalLogs,
            TopCriers = topCriers,
            TopScorers = topScorers,
            TopPairs = topPairs,
            RecentReasons = distinctRecent,
        });
    }

    // ---- helpers ----

    private async Task<string?> ValidateAsync(CryingLogUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Reason))
            return "原因為必填";
        var crierExists = await _db.Players.AnyAsync(p => p.Id == req.CrierPlayerId);
        if (!crierExists) return "找不到哭哭的人";

        var playerIds = NormalizePlayerIds(req.ScorerPlayerIds, req.CrierPlayerId).ToList();
        if (playerIds.Count > 0)
        {
            var found = await _db.Players.CountAsync(p => playerIds.Contains(p.Id));
            if (found != playerIds.Count) return "加分者清單包含不存在的球員";
        }

        foreach (var n in NormalizeExternalNames(req.ScorerExternalNames))
        {
            if (n.Length > 64) return "外部加分者名字最長 64 字";
        }
        return null;
    }

    private static IEnumerable<int> NormalizePlayerIds(IEnumerable<int> raw, int crierId)
        => raw.Where(id => id != crierId).Distinct();

    private static IEnumerable<string> NormalizeExternalNames(IEnumerable<string> raw)
        => raw
            .Select(n => n?.Trim() ?? string.Empty)
            .Where(n => !string.IsNullOrEmpty(n))
            .Distinct(StringComparer.Ordinal);

    private async Task<CryingLogDto?> LoadDtoAsync(int id)
    {
        var log = await _db.CryingLogs
            .Include(x => x.Crier)
            .Include(x => x.UpdatedByUser)
            .Include(x => x.Culprits).ThenInclude(c => c.Player)
            .FirstOrDefaultAsync(x => x.Id == id);
        return log == null ? null : ToDto(log);
    }

    private static CryingLogDto ToDto(CryingLog x) => new()
    {
        Id = x.Id,
        OccurredAt = x.OccurredAt,
        CrierPlayerId = x.CrierPlayerId,
        CrierName = x.Crier?.Name ?? string.Empty,
        CrierJerseyNo = x.Crier?.JerseyNo,
        Reason = x.Reason,
        Notes = x.Notes,
        Scorers = x.Culprits
            // 球員優先（依背號、姓名），外部其後（依名字）
            .OrderBy(c => c.PlayerId.HasValue ? 0 : 1)
            .ThenBy(c => c.Player?.JerseyNo ?? int.MaxValue)
            .ThenBy(c => c.Player?.Name ?? c.ExternalName)
            .Select(c => c.PlayerId.HasValue
                ? new CryingScorerDto
                {
                    Kind = KindPlayer,
                    PlayerId = c.PlayerId,
                    Name = c.Player?.Name ?? string.Empty,
                    JerseyNo = c.Player?.JerseyNo,
                }
                : new CryingScorerDto
                {
                    Kind = KindExternal,
                    PlayerId = null,
                    Name = c.ExternalName ?? string.Empty,
                    JerseyNo = null,
                })
            .ToList(),
        CreatedAt = x.CreatedAt,
        UpdatedAt = x.UpdatedAt,
        UpdatedByName = x.UpdatedByUser != null
            ? (x.UpdatedByUser.DisplayName ?? x.UpdatedByUser.UserName)
            : null,
    };
}
