using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using VolleyballTrainingTracker.Server.Auth;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.Auth;

public class RequirePermissionAttributeTests
{
    private static AuthorizationFilterContext BuildContext(ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        return new AuthorizationFilterContext(actionContext, new List<IFilterMetadata>());
    }

    private static ClaimsPrincipal Authenticated(params string[] permissions)
    {
        var claims = permissions.Select(p => new Claim(JwtClaimTypes.Permission, p));
        var identity = new ClaimsIdentity(claims, authenticationType: "TestAuth");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public void Unauthenticated_ReturnsUnauthorized()
    {
        var ctx = BuildContext(new ClaimsPrincipal(new ClaimsIdentity()));

        new RequirePermissionAttribute(Permissions.PlayersEdit).OnAuthorization(ctx);

        Assert.IsType<UnauthorizedResult>(ctx.Result);
    }

    [Fact]
    public void AuthenticatedWithoutPermission_ReturnsForbidden()
    {
        var ctx = BuildContext(Authenticated(Permissions.SessionsEdit));

        new RequirePermissionAttribute(Permissions.PlayersEdit).OnAuthorization(ctx);

        var result = Assert.IsType<ObjectResult>(ctx.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
    }

    [Fact]
    public void AuthenticatedWithPermission_AllowsRequest()
    {
        var ctx = BuildContext(Authenticated(Permissions.PlayersEdit, Permissions.SessionsEdit));

        new RequirePermissionAttribute(Permissions.PlayersEdit).OnAuthorization(ctx);

        Assert.Null(ctx.Result);
    }
}
