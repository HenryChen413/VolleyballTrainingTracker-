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
public class DrillsController : ControllerBase
{
    private static readonly HashSet<string> AllowedCategories =
        new(StringComparer.Ordinal) { "Basic", "Serve", "Pass", "Set", "Attack", "Block", "Dig", "Fitness" };

    private readonly AppDbContext _db;
    public DrillsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DrillDto>>> List([FromQuery] bool? activeOnly = null)
    {
        var q = _db.Drills.AsQueryable();
        if (activeOnly != false) q = q.Where(d => d.IsActive);
        var list = await q
            .OrderBy(d => d.Category).ThenBy(d => d.Name)
            .Select(d => ToDto(d))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DrillDto>> Get(int id)
    {
        var d = await _db.Drills.Include(x => x.UpdatedByUser).FirstOrDefaultAsync(x => x.Id == id);
        return d == null ? NotFound() : Ok(ToDto(d));
    }

    [HttpPost]
    [RequirePermission(Permissions.DrillsEdit)]
    public async Task<ActionResult<DrillDto>> Create([FromBody] DrillUpsertRequest req)
    {
        if (!AllowedCategories.Contains(req.Category))
            return BadRequest(new { message = "分類不合法" });
        if (await _db.Drills.AnyAsync(x => x.Name == req.Name))
            return BadRequest(new { message = "名稱已存在" });

        var d = new Drill
        {
            Name = req.Name.Trim(),
            Category = req.Category,
            Description = req.Description,
            IsActive = req.IsActive,
        };
        _db.Drills.Add(d);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = d.Id }, ToDto(d));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.DrillsEdit)]
    public async Task<ActionResult<DrillDto>> Update(int id, [FromBody] DrillUpsertRequest req)
    {
        var d = await _db.Drills.FindAsync(id);
        if (d == null) return NotFound();
        if (!AllowedCategories.Contains(req.Category))
            return BadRequest(new { message = "分類不合法" });
        if (await _db.Drills.AnyAsync(x => x.Name == req.Name && x.Id != id))
            return BadRequest(new { message = "名稱已存在" });

        d.Name = req.Name.Trim();
        d.Category = req.Category;
        d.Description = req.Description;
        d.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return Ok(ToDto(d));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.DrillsEdit)]
    public async Task<IActionResult> Delete(int id)
    {
        var d = await _db.Drills.FindAsync(id);
        if (d == null) return NotFound();
        d.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static DrillDto ToDto(Drill d) => new()
    {
        Id = d.Id,
        Name = d.Name,
        Category = d.Category,
        Description = d.Description,
        IsActive = d.IsActive,
        CreatedAt = d.CreatedAt,
        UpdatedAt = d.UpdatedAt,
        UpdatedByName = d.UpdatedByUser != null ? (d.UpdatedByUser.DisplayName ?? d.UpdatedByUser.UserName) : null,
    };
}
