using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace VolleyballTrainingTracker.Server.Auth;

/// <summary>
/// 必須搭配 [Authorize] 使用：JWT 通過驗證後再檢查使用者是否持有指定的 perm claim。
/// 通過：放行；缺權限：回 403。
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequirePermissionAttribute : Attribute, IAuthorizationFilter
{
    public string Permission { get; }

    public RequirePermissionAttribute(string permission)
    {
        Permission = permission;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity is null || !user.Identity.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        var has = user.FindAll(JwtClaimTypes.Permission).Any(c => c.Value == Permission);
        if (!has)
        {
            context.Result = new ObjectResult(new { message = $"缺少權限：{Permission}" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}

public static class JwtClaimTypes
{
    public const string Permission = "perm";
    public const string Page = "page";
}
