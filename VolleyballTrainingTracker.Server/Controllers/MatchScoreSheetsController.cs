using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;
using VolleyballTrainingTracker.Server.ScoreSheets;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 比賽記錄單：每場對戰（MatchLog）每局一筆，內容為 jsonb 文件。
/// 全部端點以 [RequirePage(Pages.MatchLogs)] 控管。
/// 儲存以 Version 做樂觀並行控制，版本不符回 409；儲存時順帶把該局比分回填到 MatchLog。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.MatchLogs)]
[Route("api/matchlogs/{matchLogId:int}/sheets")]
public class MatchScoreSheetsController : ControllerBase
{
    private readonly AppDbContext _db;
    public MatchScoreSheetsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<MatchScoreSheetsResponse>> List(int matchLogId)
    {
        var log = await _db.MatchLogs.AsNoTracking()
            .Where(m => m.Id == matchLogId)
            .Select(m => new
            {
                m.Id,
                m.MatchEventId,
                m.Opponent,
                m.OurSquad,
                MatchDate = m.MatchDate ?? m.MatchEvent!.MatchDate,
                m.MatchEvent!.MatchType,
            })
            .FirstOrDefaultAsync();
        if (log == null) return NotFound(new { message = "找不到此對戰" });

        var rosterQuery = _db.MatchEventPlayers.AsNoTracking()
            .Where(p => p.MatchEventId == log.MatchEventId);
        if (log.OurSquad != null) rosterQuery = rosterQuery.Where(p => p.OurSquad == log.OurSquad);
        var roster = await rosterQuery
            .OrderBy(p => p.JerseyNo ?? int.MaxValue)
            .ThenBy(p => p.PlayerName)
            .Select(p => new SheetRosterPlayerDto
            {
                PlayerId = p.PlayerId,
                Name = p.PlayerName,
                JerseyNo = p.JerseyNo,
                Position = p.Position,
            })
            .ToListAsync();

        if (roster.Count == 0)
        {
            // 賽事未登錄名單時，改列全部現役球員
            roster = await _db.Players.AsNoTracking()
                .Where(p => p.IsActive == 1)
                .OrderBy(p => p.JerseyNo ?? int.MaxValue)
                .ThenBy(p => p.Name)
                .Select(p => new SheetRosterPlayerDto
                {
                    PlayerId = p.Id,
                    Name = p.Name,
                    JerseyNo = p.JerseyNo,
                    Position = p.Position,
                })
                .ToListAsync();
        }

        var rows = await _db.MatchScoreSheets.AsNoTracking()
            .Where(s => s.MatchLogId == matchLogId)
            .OrderBy(s => s.SetIndex)
            .Select(s => new SheetRow
            {
                SetIndex = s.SetIndex,
                RecorderName = s.RecorderName,
                Content = s.Content,
                Version = s.Version,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                UpdatedByName = s.UpdatedByUser != null
                    ? (s.UpdatedByUser.DisplayName ?? s.UpdatedByUser.UserName)
                    : null,
            })
            .ToListAsync();

        return Ok(new MatchScoreSheetsResponse
        {
            MatchLogId = log.Id,
            MatchEventId = log.MatchEventId,
            Opponent = log.Opponent,
            MatchDate = log.MatchDate,
            MatchType = log.MatchType,
            OurSquad = log.OurSquad,
            Roster = roster,
            Sheets = rows.Select(ToDto).ToList(),
        });
    }

    [HttpPut("{setIndex:int}")]
    public async Task<ActionResult<MatchScoreSheetDto>> Save(
        int matchLogId, int setIndex, [FromBody] MatchScoreSheetSaveRequest req)
    {
        if (setIndex < 1 || setIndex > ScoreSheetRules.MaxSetIndex)
            return BadRequest(new { message = $"局號必須介於 1 到 {ScoreSheetRules.MaxSetIndex}" });

        // 友誼賽回填需要 Sets，故一併載入
        var log = await _db.MatchLogs
            .Include(m => m.MatchEvent)
            .Include(m => m.Sets)
            .FirstOrDefaultAsync(m => m.Id == matchLogId);
        if (log == null) return NotFound(new { message = "找不到此對戰" });

        var err = ScoreSheetRules.ValidateContent(req.Content);
        if (err != null) return BadRequest(new { message = err });

        var existing = await _db.MatchScoreSheets
            .FirstOrDefaultAsync(s => s.MatchLogId == matchLogId && s.SetIndex == setIndex);

        var contentJson = req.Content.GetRawText();
        var recorder = req.RecorderName?.Trim();
        if (string.IsNullOrEmpty(recorder)) recorder = null;
        else if (recorder.Length > 64) recorder = recorder[..64];

        if (existing == null)
        {
            // 新建：版本必須為 0，且局號必須是目前最大局號 + 1
            if (req.ExpectedVersion != 0) return await ConflictAsync(matchLogId, setIndex);

            var currentMax = await MaxSetIndexAsync(matchLogId);
            var idxErr = ScoreSheetRules.ValidateNewSetIndex(setIndex, currentMax);
            if (idxErr != null) return BadRequest(new { message = idxErr });

            _db.MatchScoreSheets.Add(new MatchScoreSheet
            {
                MatchLogId = matchLogId,
                SetIndex = (short)setIndex,
                RecorderName = recorder,
                Content = contentJson,
                Version = 1,
            });
        }
        else
        {
            if (req.ExpectedVersion != existing.Version) return await ConflictAsync(matchLogId, setIndex);

            existing.RecorderName = recorder;
            existing.Content = contentJson;
            existing.Version = existing.Version + 1;
        }

        var score = ScoreSheetRules.ComputeFinalScore(req.Content);
        if (score != null)
        {
            ScoreSheetRules.ApplyBackfill(log, log.MatchEvent?.MatchType, setIndex, score.Value.Our, score.Value.Opp);
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // 檢查版本後、寫入前被他人搶先更新（UPDATE 的 WHERE "Version" 不符）
            _db.ChangeTracker.Clear();
            return await ConflictAsync(matchLogId, setIndex);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // 兩人同時新增同一局：第二筆撞 UX_MatchScoreSheets_LogSet
            _db.ChangeTracker.Clear();
            return await ConflictAsync(matchLogId, setIndex);
        }

        var row = await LoadRowAsync(matchLogId, setIndex);
        return Ok(ToDto(row!));
    }

    [HttpDelete("{setIndex:int}")]
    public async Task<IActionResult> Delete(int matchLogId, int setIndex)
    {
        if (setIndex < 1 || setIndex > ScoreSheetRules.MaxSetIndex)
            return BadRequest(new { message = $"局號必須介於 1 到 {ScoreSheetRules.MaxSetIndex}" });

        var entity = await _db.MatchScoreSheets
            .FirstOrDefaultAsync(s => s.MatchLogId == matchLogId && s.SetIndex == setIndex);
        if (entity == null) return NotFound(new { message = "找不到此局記錄單" });

        var currentMax = await MaxSetIndexAsync(matchLogId);
        if (!ScoreSheetRules.CanDelete(setIndex, currentMax))
            return BadRequest(new { message = "只能刪除最後一局" });

        // 刪除不回填、不回退已寫入 MatchLog 的局分
        _db.MatchScoreSheets.Remove(entity);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<int> MaxSetIndexAsync(int matchLogId) =>
        await _db.MatchScoreSheets.AsNoTracking()
            .Where(s => s.MatchLogId == matchLogId)
            .Select(s => (int?)s.SetIndex)
            .MaxAsync() ?? 0;

    private sealed class SheetRow
    {
        public short SetIndex { get; set; }
        public string? RecorderName { get; set; }
        public string Content { get; set; } = "{}";
        public int Version { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedByName { get; set; }
    }

    private async Task<SheetRow?> LoadRowAsync(int matchLogId, int setIndex) =>
        await _db.MatchScoreSheets.AsNoTracking()
            .Where(s => s.MatchLogId == matchLogId && s.SetIndex == setIndex)
            .Select(s => new SheetRow
            {
                SetIndex = s.SetIndex,
                RecorderName = s.RecorderName,
                Content = s.Content,
                Version = s.Version,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                UpdatedByName = s.UpdatedByUser != null
                    ? (s.UpdatedByUser.DisplayName ?? s.UpdatedByUser.UserName)
                    : null,
            })
            .FirstOrDefaultAsync();

    private static MatchScoreSheetDto ToDto(SheetRow r)
    {
        using var doc = JsonDocument.Parse(r.Content);
        return new MatchScoreSheetDto
        {
            SetIndex = r.SetIndex,
            RecorderName = r.RecorderName,
            Content = doc.RootElement.Clone(),
            Version = r.Version,
            UpdatedAt = r.UpdatedAt ?? r.CreatedAt,
            UpdatedByName = r.UpdatedByName,
        };
    }

    private async Task<ObjectResult> ConflictAsync(int matchLogId, int setIndex)
    {
        var cur = await LoadRowAsync(matchLogId, setIndex);
        return Conflict(new
        {
            message = "此局記錄單已被他人更新，請重新載入",
            version = cur?.Version ?? 0,
            updatedAt = cur == null ? (DateTime?)null : (cur.UpdatedAt ?? cur.CreatedAt),
            updatedByName = cur?.UpdatedByName,
        });
    }
}
