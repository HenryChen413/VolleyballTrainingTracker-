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
public class PlayersController : ControllerBase
{
    private readonly AppDbContext _db;
    public PlayersController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlayerDto>>> List([FromQuery] bool? activeOnly = null)
    {
        var q = _db.Players.AsQueryable();
        if (activeOnly == true) q = q.Where(p => p.IsActive == 1);
        var list = await q.OrderBy(p => p.JerseyNo ?? 999).ThenBy(p => p.Name).Select(p => ToDto(p)).ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PlayerDto>> Get(int id)
    {
        var p = await _db.Players.Include(x => x.UpdatedByUser).FirstOrDefaultAsync(x => x.Id == id);
        return p == null ? NotFound() : Ok(ToDto(p));
    }

    [HttpPost]
    [RequirePermission(Permissions.PlayersEdit)]
    public async Task<ActionResult<PlayerDto>> Create([FromBody] PlayerUpsertRequest req)
    {
        var p = new Player
        {
            UserId = req.UserId,
            Name = req.Name,
            Nickname = req.Nickname,
            JerseyNo = req.JerseyNo,
            Position = req.Position,
            HeightCm = req.HeightCm,
            WeightKg = req.WeightKg,
            DominantHand = req.DominantHand,
            BirthDate = req.BirthDate,
            JoinedAt = req.JoinedAt ?? DateTime.UtcNow.Date,
            Grade = req.Grade,
            IsActive = req.IsActive,
            Notes = req.Notes,
        };
        _db.Players.Add(p);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = p.Id }, ToDto(p));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.PlayersEdit)]
    public async Task<ActionResult<PlayerDto>> Update(int id, [FromBody] PlayerUpsertRequest req)
    {
        var p = await _db.Players.FindAsync(id);
        if (p == null) return NotFound();
        p.UserId = req.UserId;
        p.Name = req.Name;
        p.Nickname = req.Nickname;
        p.JerseyNo = req.JerseyNo;
        p.Position = req.Position;
        p.HeightCm = req.HeightCm;
        p.WeightKg = req.WeightKg;
        p.DominantHand = req.DominantHand;
        p.BirthDate = req.BirthDate;
        if (req.JoinedAt.HasValue) p.JoinedAt = req.JoinedAt.Value;
        p.Grade = req.Grade;
        p.IsActive = req.IsActive;
        p.Notes = req.Notes;
        await _db.SaveChangesAsync();
        return Ok(ToDto(p));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.PlayersEdit)]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.Players.FindAsync(id);
        if (p == null) return NotFound();
        p.IsActive = 0; // 畢業
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}/purge")]
    [RequirePermission(Permissions.PlayersPurge)]
    public async Task<IActionResult> Purge(int id)
    {
        var p = await _db.Players.FindAsync(id);
        if (p == null) return NotFound();
        _db.Players.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static PlayerDto ToDto(Player p) => new()
    {
        Id = p.Id,
        UserId = p.UserId,
        Name = p.Name,
        Nickname = p.Nickname,
        JerseyNo = p.JerseyNo,
        Position = p.Position,
        HeightCm = p.HeightCm,
        WeightKg = p.WeightKg,
        DominantHand = p.DominantHand,
        BirthDate = p.BirthDate,
        JoinedAt = p.JoinedAt,
        Grade = p.Grade,
        IsActive = p.IsActive,
        Notes = p.Notes,
        UpdatedAt = p.UpdatedAt,
        UpdatedByName = p.UpdatedByUser != null ? (p.UpdatedByUser.DisplayName ?? p.UpdatedByUser.UserName) : null,
    };
}
