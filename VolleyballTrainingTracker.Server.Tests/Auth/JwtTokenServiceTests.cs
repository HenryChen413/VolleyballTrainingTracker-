using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Entities;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.Auth;

public class JwtTokenServiceTests
{
    // HmacSha256 要求金鑰長度 >= 256 bits（32 bytes）
    private static readonly JwtOptions TestOptions = new()
    {
        Issuer = "vbtt-test",
        Audience = "vbtt-test-aud",
        SecretKey = "test-secret-key-at-least-32-chars-long-0123456789",
        AccessTokenMinutes = 60,
    };

    private static JwtTokenService CreateService() =>
        new(Options.Create(TestOptions));

    private static User CoachUser() => new()
    {
        Id = 7,
        UserName = "COACH",
        Email = "coach@example.com",
        DisplayName = "教練甲",
        Role = new Role
        {
            Name = "Coach",
            Permissions = "[\"players.edit\",\"sessions.edit\"]",
            AllowedPages = "[\"dashboard\",\"players\"]",
        },
    };

    [Fact]
    public void CreateToken_ProducesTokenWithExpectedExpiry()
    {
        var (token, expiresAt) = CreateService().CreateToken(CoachUser());

        Assert.False(string.IsNullOrWhiteSpace(token));
        // 到期時間應約為 60 分鐘後（容許 1 分鐘誤差）
        var expected = DateTime.UtcNow.AddMinutes(TestOptions.AccessTokenMinutes);
        Assert.True(Math.Abs((expected - expiresAt).TotalMinutes) < 1);
    }

    [Fact]
    public void CreateToken_EmitsIdentityClaims()
    {
        var (token, _) = CreateService().CreateToken(CoachUser());
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("7", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal("COACH", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.UniqueName).Value);
        Assert.Equal("Coach", jwt.Claims.First(c => c.Type == ClaimTypes.Role).Value);
        Assert.Equal("vbtt-test", jwt.Issuer);
    }

    [Fact]
    public void CreateToken_EmitsPermissionAndPageClaims()
    {
        var (token, _) = CreateService().CreateToken(CoachUser());
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        var perms = jwt.Claims.Where(c => c.Type == JwtClaimTypes.Permission).Select(c => c.Value);
        var pages = jwt.Claims.Where(c => c.Type == JwtClaimTypes.Page).Select(c => c.Value);

        Assert.Equal(new[] { "players.edit", "sessions.edit" }, perms);
        Assert.Equal(new[] { "dashboard", "players" }, pages);
    }

    [Fact]
    public void CreateToken_FallsBackToUserNameWhenDisplayNameMissing()
    {
        var user = CoachUser();
        user.DisplayName = null;

        var (token, _) = CreateService().CreateToken(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("COACH", jwt.Claims.First(c => c.Type == "displayName").Value);
    }

    [Fact]
    public void CreateToken_ThrowsWhenRoleNotLoaded()
    {
        var user = CoachUser();
        user.Role = null;

        Assert.Throws<InvalidOperationException>(() => CreateService().CreateToken(user));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-json")]
    [InlineData("{\"a\":1}")]
    public void ParseJsonArray_ReturnsEmptyForInvalidInput(string? input)
    {
        Assert.Empty(JwtTokenService.ParseJsonArray(input));
    }

    [Fact]
    public void ParseJsonArray_ParsesValidStringArray()
    {
        var result = JwtTokenService.ParseJsonArray("[\"players.edit\",\"roles.manage\"]");
        Assert.Equal(new[] { "players.edit", "roles.manage" }, result);
    }
}
