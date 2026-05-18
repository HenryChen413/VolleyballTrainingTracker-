using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Auth;

public class JwtTokenService
{
    private readonly JwtOptions _opt;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _opt = options.Value;
    }

    /// <summary>
    /// 必須傳入 user，且 user.Role 必須已 Include 載入。
    /// </summary>
    public (string token, DateTime expiresAt) CreateToken(User user)
    {
        var role = user.Role ?? throw new InvalidOperationException("User.Role must be loaded before creating a token.");

        var perms = ParseJsonArray(role.Permissions);
        var pages = ParseJsonArray(role.AllowedPages);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.UserName),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Role, role.Name),
            new("displayName", user.DisplayName ?? user.UserName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        foreach (var p in perms) claims.Add(new Claim(JwtClaimTypes.Permission, p));
        foreach (var pg in pages) claims.Add(new Claim(JwtClaimTypes.Page, pg));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(_opt.AccessTokenMinutes);

        var jwt = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expiresAt);
    }

    public static string[] ParseJsonArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }
}
