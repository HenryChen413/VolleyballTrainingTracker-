using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 賽事總結：一次取回整個賽事所有對戰的記錄單內容，由前端計算整個賽事的統計。
/// 與記錄單相同，僅以 [RequirePage(Pages.MatchLogs)] 控管；唯讀。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.MatchLogs)]
[Route("api/matchevents/{eventId:int}/sheets")]
public class MatchEventSheetsController : ControllerBase
{
    private readonly AppDbContext _db;
    public MatchEventSheetsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<EventSheetsResponse>> Get(int eventId)
    {
        var ev = await _db.MatchEvents.AsNoTracking()
            .Where(e => e.Id == eventId)
            .Select(e => new { e.Id, e.MatchName, e.MatchDate, e.MatchType, e.SquadCount })
            .FirstOrDefaultAsync();
        if (ev == null) return NotFound(new { message = "找不到此賽事" });

        var rows = await _db.MatchScoreSheets.AsNoTracking()
            .Where(s => s.MatchLog!.MatchEventId == eventId)
            .OrderBy(s => s.MatchLogId)
            .ThenBy(s => s.SetIndex)
            .Select(s => new
            {
                s.MatchLogId,
                s.MatchLog!.Opponent,
                s.MatchLog.OurSquad,
                s.SetIndex,
                s.Content,
            })
            .ToListAsync();

        var matches = rows
            .GroupBy(r => new { r.MatchLogId, r.Opponent, r.OurSquad })
            .Select(g => new EventSheetsMatchDto
            {
                MatchLogId = g.Key.MatchLogId,
                Opponent = g.Key.Opponent,
                OurSquad = g.Key.OurSquad,
                Sheets = g.Select(r =>
                {
                    using var doc = JsonDocument.Parse(r.Content);
                    return new EventSheetDto { SetIndex = r.SetIndex, Content = doc.RootElement.Clone() };
                }).ToList(),
            })
            .ToList();

        return Ok(new EventSheetsResponse
        {
            MatchEventId = ev.Id,
            MatchName = ev.MatchName,
            MatchDate = ev.MatchDate,
            MatchType = ev.MatchType,
            SquadCount = ev.SquadCount,
            Matches = matches,
        });
    }
}
