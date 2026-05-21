using VolleyballTrainingTracker.Server.Auth;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.Auth;

/// <summary>
/// 守護權限／頁面常數的一致性：避免新增常數卻忘記登錄到 All 陣列。
/// </summary>
public class PermissionsTests
{
    [Fact]
    public void Permissions_All_ContainsEveryConstant()
    {
        Assert.Contains(Permissions.PlayersEdit, Permissions.All);
        Assert.Contains(Permissions.PlayersPurge, Permissions.All);
        Assert.Contains(Permissions.SessionsEdit, Permissions.All);
        Assert.Contains(Permissions.DrillsEdit, Permissions.All);
        Assert.Contains(Permissions.MatchLogsEdit, Permissions.All);
        Assert.Contains(Permissions.UsersManage, Permissions.All);
        Assert.Contains(Permissions.RolesManage, Permissions.All);
        Assert.Contains(Permissions.BoardManage, Permissions.All);
    }

    [Fact]
    public void Permissions_All_HasNoDuplicates()
    {
        Assert.Equal(Permissions.All.Length, Permissions.All.Distinct().Count());
    }

    [Fact]
    public void Pages_All_ContainsEveryConstant()
    {
        Assert.Contains(Pages.Dashboard, Pages.All);
        Assert.Contains(Pages.Players, Pages.All);
        Assert.Contains(Pages.Sessions, Pages.All);
        Assert.Contains(Pages.MatchLogs, Pages.All);
        Assert.Contains(Pages.Drills, Pages.All);
        Assert.Contains(Pages.Board, Pages.All);
        Assert.Contains(Pages.AdminRoles, Pages.All);
        Assert.Contains(Pages.AdminUsers, Pages.All);
        Assert.Contains(Pages.Profile, Pages.All);
    }

    [Fact]
    public void Pages_All_HasNoDuplicates()
    {
        Assert.Equal(Pages.All.Length, Pages.All.Distinct().Count());
    }
}
