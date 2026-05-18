using System.Text.Json;
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
public class RolesController : ControllerBase
{
    private readonly AppDbContext _db;
    public RolesController(AppDbContext db) => _db = db;

    [HttpGet("catalog")]
    public ActionResult<RoleCatalogDto> Catalog()
    {
        return Ok(new RoleCatalogDto
        {
            AllPermissions = Permissions.All.ToList(),
            AllPages = Pages.All.ToList(),
        });
    }

    [HttpGet]
    [RequirePermission(Permissions.RolesManage)]
    public async Task<ActionResult<IEnumerable<RoleDto>>> List()
    {
        var roles = await _db.Roles
            .Select(r => new
            {
                r.Id, r.Name, r.Description, r.AllowedPages, r.Permissions, r.IsSystem,
                UserCount = r.Users.Count,
            })
            .OrderBy(r => r.Id)
            .ToListAsync();

        return Ok(roles.Select(r => new RoleDto
        {
            Id = r.Id,
            Name = r.Name,
            Description = r.Description,
            AllowedPages = JwtTokenService.ParseJsonArray(r.AllowedPages).ToList(),
            Permissions = JwtTokenService.ParseJsonArray(r.Permissions).ToList(),
            IsSystem = r.IsSystem,
            UserCount = r.UserCount,
        }));
    }

    [HttpGet("{id:int}")]
    [RequirePermission(Permissions.RolesManage)]
    public async Task<ActionResult<RoleDto>> Get(int id)
    {
        var r = await _db.Roles.FindAsync(id);
        if (r == null) return NotFound();
        var userCount = await _db.Users.CountAsync(u => u.RoleId == id);
        return Ok(ToDto(r, userCount));
    }

    [HttpPost]
    [RequirePermission(Permissions.RolesManage)]
    public async Task<ActionResult<RoleDto>> Create([FromBody] RoleUpsertRequest req)
    {
        if (await _db.Roles.AnyAsync(r => r.Name == req.Name))
            return Conflict(new { message = "角色名稱已存在" });

        var (perms, pages) = Normalize(req);
        var role = new Role
        {
            Name = req.Name,
            Description = req.Description,
            Permissions = JsonSerializer.Serialize(perms),
            AllowedPages = JsonSerializer.Serialize(pages),
            IsSystem = false,
        };
        _db.Roles.Add(role);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = role.Id }, ToDto(role, 0));
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.RolesManage)]
    public async Task<ActionResult<RoleDto>> Update(int id, [FromBody] RoleUpsertRequest req)
    {
        var role = await _db.Roles.FindAsync(id);
        if (role == null) return NotFound();

        var (perms, pages) = Normalize(req);

        // 系統角色不允許改名，避免破壞 backfill 對應
        if (!role.IsSystem)
        {
            if (role.Name != req.Name && await _db.Roles.AnyAsync(r => r.Name == req.Name))
                return Conflict(new { message = "角色名稱已存在" });
            role.Name = req.Name;
        }
        role.Description = req.Description;
        role.Permissions = JsonSerializer.Serialize(perms);
        role.AllowedPages = JsonSerializer.Serialize(pages);
        await _db.SaveChangesAsync();

        var userCount = await _db.Users.CountAsync(u => u.RoleId == id);
        return Ok(ToDto(role, userCount));
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.RolesManage)]
    public async Task<IActionResult> Delete(int id)
    {
        var role = await _db.Roles.FindAsync(id);
        if (role == null) return NotFound();
        if (role.IsSystem) return BadRequest(new { message = "系統角色不可刪除" });
        var inUse = await _db.Users.AnyAsync(u => u.RoleId == id);
        if (inUse) return BadRequest(new { message = "仍有使用者使用此角色，請先改派" });
        _db.Roles.Remove(role);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- helpers ----------

    private static (List<string> perms, List<string> pages) Normalize(RoleUpsertRequest req)
    {
        var permSet = new HashSet<string>(Permissions.All);
        var pageSet = new HashSet<string>(Pages.All);
        var perms = (req.Permissions ?? new()).Where(permSet.Contains).Distinct().ToList();
        var pages = (req.AllowedPages ?? new()).Where(pageSet.Contains).Distinct().ToList();
        return (perms, pages);
    }

    private static RoleDto ToDto(Role r, int userCount) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Description = r.Description,
        AllowedPages = JwtTokenService.ParseJsonArray(r.AllowedPages).ToList(),
        Permissions = JwtTokenService.ParseJsonArray(r.Permissions).ToList(),
        IsSystem = r.IsSystem,
        UserCount = userCount,
    };
}
