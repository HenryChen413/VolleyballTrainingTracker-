using System.Globalization;
using System.Security.Claims;
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
public class SessionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public SessionsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SessionListItemDto>>> List([FromQuery] int? take = null)
    {
        IQueryable<TrainingSession> q = _db.TrainingSessions
            .OrderByDescending(s => s.SessionDate)
            .ThenByDescending(s => s.Id);
        if (take.HasValue) q = q.Take(take.Value);
        var list = await q.Select(s => new SessionListItemDto
        {
            Id = s.Id,
            SessionDate = s.SessionDate,
            StartTime = s.StartTime.HasValue ? s.StartTime.Value.ToString(@"hh\:mm") : null,
            Location = s.Location,
            Notes = s.Notes,
        }).ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SessionDto>> Get(int id)
    {
        var dto = await GetById(id);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    [RequirePermission(Permissions.SessionsEdit)]
    public async Task<ActionResult<SessionDto>> Create([FromBody] SessionUpsertRequest req)
    {
        var coachId = GetUserId();
        if (coachId is null) return Unauthorized();
        var s = new TrainingSession
        {
            SessionDate = req.SessionDate.Date,
            StartTime = ParseTime(req.StartTime),
            Location = req.Location,
            Notes = req.Notes,
            CoachUserId = coachId.Value,
        };
        _db.TrainingSessions.Add(s);
        await _db.SaveChangesAsync();

        if (req.DrillIds != null)
            await ReplaceDrillsAsync(s, req.DrillIds);

        return CreatedAtAction(nameof(Get), new { id = s.Id }, await GetById(s.Id));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.SessionsEdit)]
    public async Task<ActionResult<SessionDto>> Update(int id, [FromBody] SessionUpsertRequest req)
    {
        var s = await _db.TrainingSessions.Include(x => x.SessionDrills).FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return NotFound();
        s.SessionDate = req.SessionDate.Date;
        s.StartTime = ParseTime(req.StartTime);
        s.Location = req.Location;
        s.Notes = req.Notes;
        if (req.DrillIds != null)
            await ReplaceDrillsAsync(s, req.DrillIds);

        await _db.SaveChangesAsync();
        return Ok(await GetById(id));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.SessionsEdit)]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await _db.TrainingSessions.FindAsync(id);
        if (s == null) return NotFound();
        _db.TrainingSessions.Remove(s);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- helpers ----------

    private async Task ReplaceDrillsAsync(TrainingSession s, List<int> drillIds)
    {
        if (s.SessionDrills.Count == 0)
            await _db.Entry(s).Collection(x => x.SessionDrills).LoadAsync();
        _db.SessionDrills.RemoveRange(s.SessionDrills);
        var distinct = drillIds.Distinct().ToList();
        foreach (var did in distinct)
        {
            s.SessionDrills.Add(new SessionDrill
            {
                SessionId = s.Id,
                DrillId = did,
            });
        }
        await _db.SaveChangesAsync();
    }

    private int? GetUserId()
    {
        var v = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(v, out var n) ? n : null;
    }

    private static TimeSpan? ParseTime(string? hhmm)
    {
        if (string.IsNullOrWhiteSpace(hhmm)) return null;
        return TimeSpan.TryParseExact(hhmm, "hh\\:mm", CultureInfo.InvariantCulture, out var ts) ? ts : null;
    }

    private async Task<SessionDto?> GetById(int id)
    {
        var s = await _db.TrainingSessions
            .Include(x => x.SessionDrills).ThenInclude(sd => sd.Drill)
            .Include(x => x.UpdatedByUser)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (s == null) return null;
        return new SessionDto
        {
            Id = s.Id,
            SessionDate = s.SessionDate,
            StartTime = s.StartTime?.ToString(@"hh\:mm"),
            Location = s.Location,
            Notes = s.Notes,
            UpdatedAt = s.UpdatedAt,
            UpdatedByName = s.UpdatedByUser != null ? (s.UpdatedByUser.DisplayName ?? s.UpdatedByUser.UserName) : null,
            Drills = s.SessionDrills
                .Where(sd => sd.Drill != null)
                .Select(sd => new SessionDrillDto
                {
                    DrillId = sd.DrillId,
                    DrillName = sd.Drill!.Name,
                    Category = sd.Drill!.Category,
                })
                .OrderBy(d => d.Category)
                .ThenBy(d => d.DrillName)
                .ToList(),
        };
    }
}
