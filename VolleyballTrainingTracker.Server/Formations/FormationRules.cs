using System.Text;
using System.Text.Json;
using VolleyballTrainingTracker.Server.Auth;

namespace VolleyballTrainingTracker.Server.Formations;

/// <summary>
/// 站位（Formations）的純規則：Key 白名單與對應頁面權限、Layout 基本驗證。
/// 細部結構（格子代碼、座標範圍）由前端解析器負責，伺服器只守住「是物件、不過大、版本正確」。
/// </summary>
public static class FormationRules
{
    public const int MaxLayoutBytes = 64 * 1024;

    private static readonly Dictionary<string, string> KeyToPage = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["defense"] = Pages.Defense,
        ["receive-2oh"] = Pages.Receive,
        ["receive-oh1-opp"] = Pages.Receive,
        ["receive-oh2-opp"] = Pages.Receive,
        ["receive-2oh-opp"] = Pages.Receive,
    };

    /// <summary>Key 對應的頁面權限；非白名單回 null。</summary>
    public static string? PageForKey(string key) =>
        KeyToPage.TryGetValue(key, out var page) ? page : null;

    /// <summary>驗證 Layout；合法回 null，否則回錯誤訊息。</summary>
    public static string? ValidateLayout(JsonElement layout)
    {
        if (layout.ValueKind != JsonValueKind.Object) return "站位資料格式錯誤";
        if (Encoding.UTF8.GetByteCount(layout.GetRawText()) > MaxLayoutBytes) return "站位資料過大";
        if (!layout.TryGetProperty("version", out var v)
            || v.ValueKind != JsonValueKind.Number
            || !v.TryGetInt32(out var n)
            || n != 1)
        {
            return "站位資料版本不支援";
        }
        return null;
    }
}
