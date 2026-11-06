namespace VolleyballTrainingTracker.Server.ScoreSheets;

/// <summary>
/// 從賽事直接開始記錄單：驗證對手與隊別、判斷是否為同一對手、決定下一局局號。
/// </summary>
public static class SheetStartRules
{
    public const int MaxOpponentLength = 128;

    public sealed record Normalized(string Opponent, string? Squad, string? Error);

    /// <summary>
    /// 對手去頭尾空白且必填；分隊賽事（SquadCount ≥ 2）隊別必須為 A 或 B，否則一律為 null。
    /// </summary>
    public static Normalized Normalize(string? opponent, string? squad, int squadCount)
    {
        var name = opponent?.Trim() ?? string.Empty;
        if (name.Length == 0) return new(name, null, "請填寫對手");
        if (name.Length > MaxOpponentLength) return new(name, null, $"對手名稱不可超過 {MaxOpponentLength} 字");

        if (squadCount < 2) return new(name, null, null);

        var s = squad?.Trim().ToUpperInvariant();
        if (s != "A" && s != "B") return new(name, null, "請選擇 A 隊或 B 隊");
        return new(name, s, null);
    }

    /// <summary>同一對手：忽略頭尾空白與英文大小寫。</summary>
    public static bool SameOpponent(string a, string b) =>
        string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    public static int NextSetIndex(IEnumerable<int> existingSetIndexes) =>
        existingSetIndexes.DefaultIfEmpty(0).Max() + 1;
}
