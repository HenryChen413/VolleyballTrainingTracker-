using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace VolleyballTrainingTracker.Server.Auth;

/// <summary>
/// 必須搭配 [Authorize] 使用：JWT 通過驗證後再檢查使用者是否可進入指定的 page。
/// 用於「沒有 perm.* 顆粒、但仍需限制頁面內所有動作」的功能（如哭哭榜：可看就可編）。
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequirePageAttribute : Attribute, IAuthorizationFilter
{
    public string Page { get; }

    public RequirePageAttribute(string page)
    {
        Page = page;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity is null || !user.Identity.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        var has = user.FindAll(JwtClaimTypes.Page).Any(c => c.Value == Page);
        if (!has)
        {
            context.Result = new ObjectResult(new { message = $"無此頁面權限：{Page}" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
