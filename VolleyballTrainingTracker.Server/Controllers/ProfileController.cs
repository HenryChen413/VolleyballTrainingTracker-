using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 使用者僅能修改自己的 Email / DisplayName / 密碼。
/// 不開放任何「以 id 指定他人」的端點。
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProfileController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<UserInfo>> Get()
    {
        var id = GetUserId();
        if (id is null) return Unauthorized();
        var u = await _db.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == id);
        if (u == null) return NotFound();
        return Ok(BuildInfo(u));
    }

    [HttpPut]
    public async Task<ActionResult<UserInfo>> Update([FromBody] ProfileUpdateRequest req)
    {
        var id = GetUserId();
        if (id is null) return Unauthorized();
        var u = await _db.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == id);
        if (u == null) return NotFound();

        if (!string.Equals(u.Email, req.Email, StringComparison.OrdinalIgnoreCase))
        {
            var dup = await _db.Users.AnyAsync(x => x.Email == req.Email && x.Id != u.Id);
            if (dup) return Conflict(new { message = "Email 已被使用" });
            u.Email = req.Email;
        }
        u.DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? null : req.DisplayName.Trim();
        await _db.SaveChangesAsync();
        return Ok(BuildInfo(u));
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var id = GetUserId();
        if (id is null) return Unauthorized();
        var u = await _db.Users.FindAsync(id.Value);
        if (u == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, u.PasswordHash))
            return BadRequest(new { message = "目前密碼錯誤" });
        if (req.CurrentPassword == req.NewPassword)
            return BadRequest(new { message = "新密碼不可與目前密碼相同" });

        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private int? GetUserId()
    {
        var v = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(v, out var n) ? n : null;
    }

    private static UserInfo BuildInfo(Entities.User u)
    {
        var role = u.Role!;
        return new UserInfo
        {
            Id = u.Id,
            UserName = u.UserName,
            Email = u.Email,
            DisplayName = u.DisplayName,
            RoleId = u.RoleId,
            Role = role.Name,
            Permissions = JwtTokenService.ParseJsonArray(role.Permissions).ToList(),
            AllowedPages = JwtTokenService.ParseJsonArray(role.AllowedPages).ToList(),
        };
    }
}
