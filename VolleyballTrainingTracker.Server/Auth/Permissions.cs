namespace VolleyballTrainingTracker.Server.Auth;

/// <summary>
/// 集中管理所有「會改 DB 的動作」權限字串。
/// 角色 (Role.Permissions) 內容必須是這些字串的子集。
/// 模型：每資源一個 Edit（涵蓋 create/update/delete）+ 特殊破壞性／管理性權限。
/// </summary>
public static class Permissions
{
    public const string PlayersEdit   = "players.edit";
    public const string PlayersPurge  = "players.purge";

    public const string SessionsEdit  = "sessions.edit";
    public const string DrillsEdit    = "drills.edit";
    public const string MatchLogsEdit = "matchlogs.edit";

    public const string UsersManage   = "users.manage";
    public const string RolesManage   = "roles.manage";

    // 留言板：一般動作（發文/回覆/按讚/刪自己的）只需 Pages.Board；
    // 此權限額外授予「刪除任何人的貼文/回覆、置頂」的管理能力。
    public const string BoardManage   = "board.manage";

    // 隊費贊助榜：看／編分離。Pages.Sponsors 控誰看得到芳名榜；
    // 此權限額外授予新增/修改/刪除贊助者與贊助紀錄的能力（金錢較敏感）。
    public const string SponsorsEdit  = "sponsors.edit";

    public static readonly string[] All =
    {
        PlayersEdit, PlayersPurge,
        SessionsEdit, DrillsEdit, MatchLogsEdit,
        UsersManage, RolesManage,
        BoardManage,
        SponsorsEdit,
    };
}

/// <summary>
/// 集中管理頁面識別碼，角色 (Role.AllowedPages) 控制哪些角色看得到。
/// </summary>
public static class Pages
{
    public const string Dashboard = "dashboard";
    public const string Calendar = "calendar";
    public const string Players = "players";
    public const string Sessions = "sessions";
    public const string MatchLogs = "match-logs";
    public const string Drills = "drills";
    public const string Crying = "crying";
    public const string Board = "board";
    public const string Sponsors = "sponsors";
    public const string AdminRoles = "admin-roles";
    public const string AdminUsers = "admin-users";
    public const string Profile = "profile";

    public static readonly string[] All =
    {
        Dashboard, Calendar, Players, Sessions, MatchLogs, Drills, Crying, Board, Sponsors, AdminRoles, AdminUsers, Profile,
    };
}
