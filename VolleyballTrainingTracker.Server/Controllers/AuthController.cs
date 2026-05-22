using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtTokenService _jwt;

    public AuthController(AppDbContext db, JwtTokenService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var userNameUpper = req.UserName.ToUpperInvariant();
        var user = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserName == userNameUpper);
        if (user == null || !user.IsActive)
            return Unauthorized(new { message = "帳號或密碼錯誤" });
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "帳號或密碼錯誤" });
        if (user.Role == null)
            return StatusCode(500, new { message = "使用者未綁定角色" });

        // 記錄最近一次成功登入時間（UTC）
        // 以 ExecuteUpdate 直接更新單一欄位，避免觸發 SaveChanges 的稽核戳記
        // （否則登入會被誤記為一次「更新」並把 UpdatedAt/UpdatedByUserId 蓋掉）
        await _db.Users
            .Where(u => u.Id == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAt, DateTime.UtcNow));

        return Ok(BuildResponse(user));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserInfo>> Me()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("sub");
        if (!int.TryParse(idStr, out var id)) return Unauthorized();
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null || user.Role == null) return NotFound();
        return Ok(BuildInfo(user));
    }

    private AuthResponse BuildResponse(User u)
    {
        var (token, expires) = _jwt.CreateToken(u);
        return new AuthResponse
        {
            AccessToken = token,
            ExpiresAt = expires,
            User = BuildInfo(u),
        };
    }

    private static UserInfo BuildInfo(User u)
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
