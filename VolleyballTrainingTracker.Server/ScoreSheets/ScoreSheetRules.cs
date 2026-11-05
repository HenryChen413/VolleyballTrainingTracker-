using System.Text;
using System.Text.Json;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.ScoreSheets;

/// <summary>
/// 比賽記錄單的純規則：Content 驗證、局號規則、由 rally 計算比分、回填 MatchLog。
/// </summary>
public static class ScoreSheetRules
{
    public const int MaxSetIndex = 50;
    public const int MaxContentBytes = 64 * 1024;

    private static readonly HashSet<string> RallyValues = new(StringComparer.Ordinal) { "U", "O", "TU", "TO" };

    /// <summary>驗證 Content 文件；合法回 null，否則回繁中錯誤訊息。</summary>
    public static string? ValidateContent(JsonElement content)
    {
        if (content.ValueKind != JsonValueKind.Object) return "內容必須是 JSON 物件";
        if (Encoding.UTF8.GetByteCount(content.GetRawText()) > MaxContentBytes) return "內容過大";

        if (!content.TryGetProperty("lineup", out var lineup) || lineup.ValueKind != JsonValueKind.Array
            || lineup.GetArrayLength() != 6)
            return "lineup 必須是長度 6 的陣列";
        foreach (var p in lineup.EnumerateArray())
        {
            if (p.ValueKind != JsonValueKind.Null && !IsNonNegativeInt(p)) return "lineup 內容必須是球員編號或 null";
        }

        if (!content.TryGetProperty("rows", out var rows) || rows.ValueKind != JsonValueKind.Array)
            return "rows 必須是陣列";
        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Object) return "rows 每筆必須是物件";
            if (!row.TryGetProperty("playerId", out var pid) || !IsNonNegativeInt(pid)) return "rows 每筆必須有 playerId";
            if (row.TryGetProperty("counts", out var counts))
            {
                if (counts.ValueKind != JsonValueKind.Object) return "counts 必須是物件";
                foreach (var kv in counts.EnumerateObject())
                {
                    if (!IsNonNegativeInt(kv.Value)) return "counts 的值必須是非負整數";
                }
            }
        }

        foreach (var name in new[] { "oppErrors", "ourErrors" })
        {
            if (!content.TryGetProperty(name, out var v) || !IsNonNegativeInt(v)) return name + " 必須是非負整數";
        }

        if (!content.TryGetProperty("rally", out var rally) || rally.ValueKind != JsonValueKind.Array)
            return "rally 必須是陣列";
        foreach (var r in rally.EnumerateArray())
        {
            if (r.ValueKind != JsonValueKind.String || !RallyValues.Contains(r.GetString()!))
                return "rally 只允許 U、O、TU、TO";
        }

        return null;
    }

    private static bool IsNonNegativeInt(JsonElement v) =>
        v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) && n >= 0;

    /// <summary>新增局號必須是目前最大局號 +1，且介於 1 至 MaxSetIndex。</summary>
    public static string? ValidateNewSetIndex(int setIndex, int currentMax)
    {
        if (setIndex < 1 || setIndex > MaxSetIndex) return $"局號必須介於 1 到 {MaxSetIndex}";
        if (setIndex != currentMax + 1) return "局號必須連續，請從下一局開始記錄";
        return null;
    }

    /// <summary>只能刪除最後一局。</summary>
    public static bool CanDelete(int setIndex, int currentMax) => setIndex == currentMax;

    /// <summary>數 rally 中的 U／O（暫停不計）；兩者皆 0 回 null。</summary>
    public static (int Our, int Opp)? ComputeFinalScore(JsonElement content)
    {
        if (content.ValueKind != JsonValueKind.Object
            || !content.TryGetProperty("rally", out var rally) || rally.ValueKind != JsonValueKind.Array)
            return null;
        int our = 0, opp = 0;
        foreach (var r in rally.EnumerateArray())
        {
            if (r.ValueKind != JsonValueKind.String) continue;
            var s = r.GetString();
            if (s == "U") our++;
            else if (s == "O") opp++;
        }
        return our == 0 && opp == 0 ? null : (our, opp);
    }

    /// <summary>
    /// 把該局比分回填到 MatchLog：正式賽（含 null）只寫第 1～3 局欄位；友誼賽新增／更新 MatchLogSets。
    /// 不動局勝數（OurScore/OpponentScore）與 Result。
    /// </summary>
    public static void ApplyBackfill(MatchLog log, string? matchType, int setIndex, int our, int opp)
    {
        if (string.Equals(matchType, "Friendly", StringComparison.Ordinal))
        {
            var set = log.Sets.FirstOrDefault(s => s.SetIndex == setIndex);
            if (set == null)
            {
                log.Sets.Add(new MatchLogSet { SetIndex = (short)setIndex, OurScore = our, OpponentScore = opp });
            }
            else
            {
                set.OurScore = our;
                set.OpponentScore = opp;
            }
            return;
        }

        switch (setIndex)
        {
            case 1: log.Set1Our = our; log.Set1Opp = opp; break;
            case 2: log.Set2Our = our; log.Set2Opp = opp; break;
            case 3: log.Set3Our = our; log.Set3Opp = opp; break;
        }
    }
}
