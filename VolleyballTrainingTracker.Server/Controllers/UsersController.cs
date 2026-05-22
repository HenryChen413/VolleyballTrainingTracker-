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
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) => _db = db;

    private const string SuperAdminUserName = "YUANHE";

    private async Task<bool> IsCallerSuperAdminAsync()
    {
        var selfId = GetUserId();
        if (selfId == null) return false;
        var name = await _db.Users
            .Where(u => u.Id == selfId.Value)
            .Select(u => u.UserName)
            .FirstOrDefaultAsync();
        return string.Equals(name, SuperAdminUserName, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<IActionResult?> EnsureSuperAdminAsync()
    {
        if (!await IsCallerSuperAdminAsync())
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = $"僅限超級管理員（{SuperAdminUserName}）可進行此操作" });
        return null;
    }

    private static bool IsSuperAdminUser(User u) =>
        string.Equals(u.UserName, SuperAdminUserName, StringComparison.OrdinalIgnoreCase);

    [HttpGet]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<ActionResult<IEnumerable<UserListItemDto>>> List()
    {
        var list = await _db.Users
            .Include(u => u.Role)
            .OrderBy(u => u.Id)
            .Select(u => new UserListItemDto
            {
                Id = u.Id,
                UserName = u.UserName,
                Email = u.Email,
                DisplayName = u.DisplayName,
                RoleId = u.RoleId,
                RoleName = u.Role!.Name,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                LastLoginAt = u.LastLoginAt,
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpPut("{id:int}/role")]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<IActionResult> SetRole(int id, [FromBody] UserRoleUpdateRequest req)
    {
        var guard = await EnsureSuperAdminAsync();
        if (guard != null) return guard;

        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        if (IsSuperAdminUser(user))
            return BadRequest(new { message = $"{SuperAdminUserName} 的角色不可變更" });
        var role = await _db.Roles.FindAsync(req.RoleId);
        if (role == null) return BadRequest(new { message = "角色不存在" });

        // 防呆：禁止把唯一的 Admin 改成非 Admin（避免系統失去 admin）
        if (user.Role?.Name == "Admin" && role.Name != "Admin")
        {
            var adminCount = await _db.Users.CountAsync(u => u.Role!.Name == "Admin" && u.IsActive);
            if (adminCount <= 1) return BadRequest(new { message = "至少需保留一位 Admin" });
        }

        user.RoleId = req.RoleId;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}/active")]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<IActionResult> SetActive(int id, [FromBody] UserActiveUpdateRequest req)
    {
        var guard = await EnsureSuperAdminAsync();
        if (guard != null) return guard;

        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        // YUANHE 永遠不可停用
        if (IsSuperAdminUser(user) && !req.IsActive)
            return BadRequest(new { message = $"{SuperAdminUserName} 不可被停用" });

        // 不可停用自己
        var selfId = GetUserId();
        if (selfId == id && !req.IsActive)
            return BadRequest(new { message = "不可停用自己" });

        if (user.Role?.Name == "Admin" && !req.IsActive)
        {
            var adminCount = await _db.Users.CountAsync(u => u.Role!.Name == "Admin" && u.IsActive);
            if (adminCount <= 1) return BadRequest(new { message = "至少需保留一位 Admin" });
        }

        user.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<ActionResult<UserListItemDto>> Create([FromBody] UserCreateRequest req)
    {
        if (!await IsCallerSuperAdminAsync())
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = $"僅限超級管理員（{SuperAdminUserName}）可進行此操作" });

        var userName = req.UserName.ToUpperInvariant();
        if (await _db.Users.AnyAsync(u => u.UserName == userName))
            return Conflict(new { message = "帳號已被使用" });

        var role = await _db.Roles.FindAsync(req.RoleId);
        if (role == null) return BadRequest(new { message = "角色不存在" });

        if (!string.IsNullOrWhiteSpace(req.Email)
            && await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { message = "Email 已被使用" });

        var user = new User
        {
            UserName = userName,
            Email = req.Email ?? string.Empty,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            RoleId = role.Id,
            DisplayName = req.DisplayName ?? req.UserName,
            IsActive = req.IsActive,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new UserListItemDto
        {
            Id = user.Id,
            UserName = user.UserName,
            Email = user.Email,
            DisplayName = user.DisplayName,
            RoleId = role.Id,
            RoleName = role.Name,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
        });
    }

    [HttpPut("{id:int}")]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<IActionResult> Update(int id, [FromBody] UserUpdateRequest req)
    {
        var guard = await EnsureSuperAdminAsync();
        if (guard != null) return guard;

        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        if (req.RoleId.HasValue && req.RoleId.Value != user.RoleId)
        {
            if (IsSuperAdminUser(user))
                return BadRequest(new { message = $"{SuperAdminUserName} 的角色不可變更" });

            var newRole = await _db.Roles.FindAsync(req.RoleId.Value);
            if (newRole == null) return BadRequest(new { message = "角色不存在" });

            if (user.Role?.Name == "Admin" && newRole.Name != "Admin")
            {
                var adminCount = await _db.Users.CountAsync(u => u.Role!.Name == "Admin" && u.IsActive);
                if (adminCount <= 1) return BadRequest(new { message = "至少需保留一位 Admin" });
            }
            user.RoleId = newRole.Id;
        }

        if (req.Email != null && req.Email != user.Email)
        {
            if (!string.IsNullOrWhiteSpace(req.Email)
                && await _db.Users.AnyAsync(u => u.Email == req.Email && u.Id != id))
                return Conflict(new { message = "Email 已被使用" });
            user.Email = req.Email;
        }

        if (req.DisplayName != null)
            user.DisplayName = req.DisplayName;

        if (!string.IsNullOrWhiteSpace(req.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [RequirePermission(Permissions.UsersManage)]
    public async Task<IActionResult> Delete(int id)
    {
        var guard = await EnsureSuperAdminAsync();
        if (guard != null) return guard;

        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        // YUANHE 永遠不可刪除
        if (IsSuperAdminUser(user))
            return BadRequest(new { message = $"{SuperAdminUserName} 不可被刪除" });

        var selfId = GetUserId();
        if (selfId == id) return BadRequest(new { message = "不可刪除自己" });

        if (user.Role?.Name == "Admin")
        {
            var adminCount = await _db.Users.CountAsync(u => u.Role!.Name == "Admin" && u.IsActive);
            if (adminCount <= 1) return BadRequest(new { message = "至少需保留一位 Admin" });
        }

        _db.Users.Remove(user);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return BadRequest(new { message = "此使用者尚有關聯資料，無法刪除，請改為停用。" });
        }
        return NoContent();
    }

    private int? GetUserId()
    {
        var v = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(v, out var n) ? n : null;
    }
}
