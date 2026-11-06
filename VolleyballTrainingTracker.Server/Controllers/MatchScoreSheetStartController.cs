using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;
using VolleyballTrainingTracker.Server.ScoreSheets;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 從賽事直接開始記錄單：依隊別＋對手找到該賽事既有的對戰（同對手取最新一場），
/// 找不到就新建一場對戰，回傳要開啟的局號（既有最大局號＋1）。
/// 與記錄單相同，僅以 [RequirePage(Pages.MatchLogs)] 控管；只新增對手與隊別，不動賽事其他資料。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.MatchLogs)]
[Route("api/matchevents/{eventId:int}/sheet-start")]
public class MatchScoreSheetStartController : ControllerBase
{
    private readonly AppDbContext _db;
    public MatchScoreSheetStartController(AppDbContext db) => _db = db;

    [HttpPost]
    public async Task<ActionResult<SheetStartResponse>> Start(int eventId, [FromBody] SheetStartRequest req)
    {
        var ev = await _db.MatchEvents.AsNoTracking()
            .Where(e => e.Id == eventId)
            .Select(e => new { e.Id, e.SquadCount })
            .FirstOrDefaultAsync();
        if (ev == null) return NotFound(new { message = "找不到此賽事" });

        var n = SheetStartRules.Normalize(req.Opponent, req.OurSquad, ev.SquadCount);
        if (n.Error != null) return BadRequest(new { message = n.Error });

        // 對手比對在記憶體做，與 SheetStartRules.SameOpponent 的規則一致
        var candidates = await _db.MatchLogs.AsNoTracking()
            .Where(m => m.MatchEventId == eventId && m.OurSquad == n.Squad)
            .Select(m => new { m.Id, m.Opponent })
            .ToListAsync();
        var existing = candidates
            .Where(m => SheetStartRules.SameOpponent(m.Opponent, n.Opponent))
            .OrderByDescending(m => m.Id)
            .FirstOrDefault();

        if (existing == null)
        {
            var log = new MatchLog { MatchEventId = eventId, Opponent = n.Opponent, OurSquad = n.Squad };
            _db.MatchLogs.Add(log);
            await _db.SaveChangesAsync();
            return Ok(new SheetStartResponse { MatchLogId = log.Id, SetIndex = 1, Created = true });
        }

        var setIndexes = await _db.MatchScoreSheets.AsNoTracking()
            .Where(s => s.MatchLogId == existing.Id)
            .Select(s => (int)s.SetIndex)
            .ToListAsync();
        var next = SheetStartRules.NextSetIndex(setIndexes);
        if (next > ScoreSheetRules.MaxSetIndex)
            return BadRequest(new { message = $"此對戰已達 {ScoreSheetRules.MaxSetIndex} 局上限" });

        return Ok(new SheetStartResponse { MatchLogId = existing.Id, SetIndex = next, Created = false });
    }
}
