using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class MatchEventsController : ControllerBase
{
    private readonly AppDbContext _db;
    public MatchEventsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<MatchEventListItemDto>>> List()
    {
        var list = await _db.MatchEvents
            .OrderByDescending(e => e.MatchDate)
            .ThenByDescending(e => e.Id)
            .Select(e => new MatchEventListItemDto
            {
                Id = e.Id,
                MatchDate = e.MatchDate,
                MatchType = e.MatchType,
                AcademicYear = e.AcademicYear,
                MatchName = e.MatchName,
                Location = e.Location,
                Ranking = e.Ranking,
                RankingB = e.RankingB,
                VideoUrl = e.VideoUrl,
                Notes = e.Notes,
                SquadCount = e.SquadCount,
                PlayerCount = e.Players.Count,
                Players = e.Players
                    .OrderBy(p => p.JerseyNo ?? int.MaxValue)
                    .ThenBy(p => p.PlayerName)
                    .Select(p => new MatchEventPlayerDto
                    {
                        PlayerId = p.PlayerId,
                        Name = p.PlayerName,
                        JerseyNo = p.JerseyNo,
                        Position = p.Position,
                        OurSquad = p.OurSquad,
                    }).ToList(),
                Matches = e.Matches
                    .OrderBy(m => m.Id)
                    .Select(m => new MatchLogItemDto
                    {
                        Id = m.Id,
                        Opponent = m.Opponent,
                        OurSquad = m.OurSquad,
                        Set1Our = m.Set1Our,
                        Set1Opp = m.Set1Opp,
                        Set2Our = m.Set2Our,
                        Set2Opp = m.Set2Opp,
                        Set3Our = m.Set3Our,
                        Set3Opp = m.Set3Opp,
                        OurScore = m.OurScore,
                        OpponentScore = m.OpponentScore,
                        Result = m.Result,
                    }).ToList(),
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MatchEventDetailDto>> Get(int id)
    {
        var e = await _db.MatchEvents
            .Include(x => x.UpdatedByUser)
            .Include(x => x.Matches)
            .Include(x => x.Players)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (e == null) return NotFound();

        return Ok(new MatchEventDetailDto
        {
            Id = e.Id,
            MatchDate = e.MatchDate,
            MatchType = e.MatchType,
            AcademicYear = e.AcademicYear,
            MatchName = e.MatchName,
            Location = e.Location,
            Ranking = e.Ranking,
            VideoUrl = e.VideoUrl,
            Notes = e.Notes,
            SquadCount = e.SquadCount,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
            UpdatedByName = e.UpdatedByUser != null
                ? (e.UpdatedByUser.DisplayName ?? e.UpdatedByUser.UserName)
                : null,
            Players = e.Players
                .OrderBy(p => p.JerseyNo ?? int.MaxValue)
                .ThenBy(p => p.PlayerName)
                .Select(p => new MatchEventPlayerDto
                {
                    PlayerId = p.PlayerId,
                    Name = p.PlayerName,
                    JerseyNo = p.JerseyNo,
                    Position = p.Position,
                    OurSquad = p.OurSquad,
                })
                .ToList(),
            Matches = e.Matches
                .OrderBy(m => m.Id)
                .Select(m => new MatchLogItemDto
                {
                    Id = m.Id,
                    Opponent = m.Opponent,
                    OurSquad = m.OurSquad,
                    Set1Our = m.Set1Our,
                    Set1Opp = m.Set1Opp,
                    Set2Our = m.Set2Our,
                    Set2Opp = m.Set2Opp,
                    Set3Our = m.Set3Our,
                    Set3Opp = m.Set3Opp,
                    OurScore = m.OurScore,
                    OpponentScore = m.OpponentScore,
                    Result = m.Result,
                }).ToList(),
        });
    }

    [HttpPost]
    [RequirePermission(Permissions.MatchLogsEdit)]
    public async Task<ActionResult<MatchEventDetailDto>> Create([FromBody] MatchEventUpsertRequest req)
    {
        if (!IsValidVideoUrl(req.VideoUrl))
            return BadRequest(new { message = "影片連結必須是 http:// 或 https:// 開頭" });

        var e = new MatchEvent();
        MapEvent(req, e);

        foreach (var m in req.Matches)
        {
            var ml = new MatchLog();
            MapLog(m, ml, req.SquadCount);
            e.Matches.Add(ml);
        }

        // dedupe by PlayerId（payload 重複的最後者勝出）
        var inputs = req.Players
            .GroupBy(p => p.PlayerId)
            .Select(g => g.Last())
            .ToList();
        var pids = inputs.Select(p => p.PlayerId).ToList();
        var snapshots = await _db.Players
            .Where(p => pids.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.JerseyNo, p.Position })
            .ToDictionaryAsync(p => p.Id);
        foreach (var inp in inputs)
        {
            if (!snapshots.TryGetValue(inp.PlayerId, out var snap)) continue;  // 跳過不存在的 PlayerId
            e.Players.Add(new MatchEventPlayer
            {
                PlayerId = inp.PlayerId,
                OurSquad = NormalizeSquad(inp.OurSquad, req.SquadCount),
                PlayerName = snap.Name,
                JerseyNo = snap.JerseyNo,
                Position = snap.Position,
            });
        }

        _db.MatchEvents.Add(e);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = e.Id }, await GetDetailAsync(e.Id));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.MatchLogsEdit)]
    public async Task<ActionResult<MatchEventDetailDto>> Update(int id, [FromBody] MatchEventUpsertRequest req)
    {
        if (!IsValidVideoUrl(req.VideoUrl))
            return BadRequest(new { message = "影片連結必須是 http:// 或 https:// 開頭" });

        var e = await _db.MatchEvents
            .Include(x => x.Matches)
            .Include(x => x.Players)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (e == null) return NotFound();

        MapEvent(req, e);

        // 同步 Matches：保留有 Id 的、新增無 Id 的、刪除不在 payload 的
        var matches = req.Matches ?? new List<MatchLogUpsertRequest>();
        var incomingIds = matches.Where(m => m.Id.HasValue).Select(m => m.Id!.Value).ToHashSet();
        var toRemove = e.Matches.Where(m => !incomingIds.Contains(m.Id)).ToList();
        foreach (var m in toRemove) _db.MatchLogs.Remove(m);

        foreach (var inc in matches)
        {
            if (inc.Id.HasValue)
            {
                var existing = e.Matches.FirstOrDefault(x => x.Id == inc.Id.Value);
                if (existing != null) MapLog(inc, existing, req.SquadCount);
            }
            else
            {
                var ml = new MatchLog();
                MapLog(inc, ml, req.SquadCount);
                e.Matches.Add(ml);
            }
        }

        // 同步 Players：移除不在 payload 的、新增的從 Player 表抓 snapshot
        // 既有的 snapshot 一律保留（歷史不變），但 OurSquad 可被更新
        var inputs = req.Players
            .GroupBy(p => p.PlayerId)
            .Select(g => g.Last())
            .ToList();
        var inputMap = inputs.ToDictionary(p => p.PlayerId);
        var existingPids = e.Players.Select(p => p.PlayerId).ToHashSet();

        foreach (var p in e.Players.Where(p => !inputMap.ContainsKey(p.PlayerId)).ToList())
            _db.MatchEventPlayers.Remove(p);

        // 更新既有球員的 OurSquad
        foreach (var p in e.Players.Where(p => inputMap.ContainsKey(p.PlayerId)))
            p.OurSquad = NormalizeSquad(inputMap[p.PlayerId].OurSquad, req.SquadCount);

        // 新加入球員 snapshot + OurSquad
        var newInputs = inputs.Where(p => !existingPids.Contains(p.PlayerId)).ToList();
        if (newInputs.Count > 0)
        {
            var newPids = newInputs.Select(p => p.PlayerId).ToList();
            var snapshots = await _db.Players
                .Where(p => newPids.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.JerseyNo, p.Position })
                .ToDictionaryAsync(p => p.Id);
            foreach (var inp in newInputs)
            {
                if (!snapshots.TryGetValue(inp.PlayerId, out var snap)) continue;
                e.Players.Add(new MatchEventPlayer
                {
                    PlayerId = inp.PlayerId,
                    OurSquad = NormalizeSquad(inp.OurSquad, req.SquadCount),
                    PlayerName = snap.Name,
                    JerseyNo = snap.JerseyNo,
                    Position = snap.Position,
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(await GetDetailAsync(e.Id));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.MatchLogsEdit)]
    public async Task<IActionResult> Delete(int id)
    {
        var e = await _db.MatchEvents.FindAsync(id);
        if (e == null) return NotFound();
        _db.MatchEvents.Remove(e);  // cascade 刪 Matches + Players
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- helpers ----

    private async Task<MatchEventDetailDto?> GetDetailAsync(int id)
    {
        var result = await Get(id);
        return (result.Result as OkObjectResult)?.Value as MatchEventDetailDto;
    }

    private static void MapEvent(MatchEventUpsertRequest req, MatchEvent e)
    {
        e.MatchDate = req.MatchDate.Date;
        e.MatchType = req.MatchType;
        e.AcademicYear = req.AcademicYear;
        e.MatchName = req.MatchName;
        e.Location = req.Location;
        e.Ranking = req.Ranking;
        // RankingB 僅在 SquadCount=2 有意義，單隊時強制清空
        e.RankingB = req.SquadCount <= 1 ? null : req.RankingB;
        e.VideoUrl = req.VideoUrl;
        e.Notes = req.Notes;
        e.SquadCount = req.SquadCount < 1 ? 1 : req.SquadCount;
    }

    private static void MapLog(MatchLogUpsertRequest req, MatchLog m, int squadCount)
    {
        m.Opponent = req.Opponent;
        m.OurSquad = squadCount <= 1 ? null : NormalizeSquad(req.OurSquad, squadCount);
        m.Set1Our = req.Set1Our;
        m.Set1Opp = req.Set1Opp;
        m.Set2Our = req.Set2Our;
        m.Set2Opp = req.Set2Opp;
        m.Set3Our = req.Set3Our;
        m.Set3Opp = req.Set3Opp;
        m.OurScore = req.OurScore;
        m.OpponentScore = req.OpponentScore;
        m.Result = req.Result;
    }

    /// <summary>空值視為合法；有值時必須是 http/https 絕對網址，擋下 javascript: 等危險 scheme。</summary>
    private static bool IsValidVideoUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return true;
        return Uri.TryCreate(url.Trim(), UriKind.Absolute, out var u)
               && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);
    }

    /// <summary>SquadCount=1 強制清為 null；否則 trim + 空字串→null。</summary>
    private static string? NormalizeSquad(string? raw, int squadCount)
    {
        if (squadCount <= 1) return null;
        var s = raw?.Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }
}
