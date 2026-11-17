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

        // liberos 為後加欄位（[接發自由, 防守自由]），舊資料可沒有；有的話必須是長度 2
        if (content.TryGetProperty("liberos", out var liberos))
        {
            if (liberos.ValueKind != JsonValueKind.Array || liberos.GetArrayLength() != 2)
                return "liberos 必須是長度 2 的陣列";
            foreach (var p in liberos.EnumerateArray())
            {
                if (p.ValueKind != JsonValueKind.Null && !IsNonNegativeInt(p)) return "liberos 內容必須是球員編號或 null";
            }
        }

        // subs 為後加欄位（換人紀錄 {out, in, at}），舊資料可沒有
        if (content.TryGetProperty("subs", out var subs))
        {
            if (subs.ValueKind != JsonValueKind.Array) return "subs 必須是陣列";
            foreach (var s in subs.EnumerateArray())
            {
                if (s.ValueKind != JsonValueKind.Object) return "subs 每筆必須是物件";
                foreach (var name in new[] { "out", "in", "at" })
                {
                    if (!s.TryGetProperty(name, out var v) || !IsNonNegativeInt(v)) return "subs 每筆必須有 out、in、at 非負整數";
                }
            }
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
    /// 局勝數（OurScore/OpponentScore）與 Result 另由 <see cref="ApplyMatchTotals"/> 處理。
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

    /// <summary>
    /// 判斷某局是否已打完：之後已經有下一局記錄單就算打完；
    /// 最後一局則看排球規則——第 1、2 局先到 25 分、第 3 局起先到 15 分，且領先至少 2 分。
    /// </summary>
    public static bool IsSetFinished(int setIndex, int our, int opp, bool hasLaterSheet)
    {
        if (hasLaterSheet) return true;
        var target = setIndex >= 3 ? 15 : 25;
        return Math.Max(our, opp) >= target && Math.Abs(our - opp) >= 2;
    }

    /// <summary>
    /// 由各局記錄單比分（局號 → 比分；rally 為空時值為 null）統計「已打完的局」的勝負局數。
    /// 平手的局與空白局不計；一局都沒打完回 null。
    /// </summary>
    public static (int Wins, int Losses)? TallyFinishedSets(IReadOnlyDictionary<int, (int Our, int Opp)?> sheetScores)
    {
        if (sheetScores.Count == 0) return null;
        var maxIndex = sheetScores.Keys.Max();
        int wins = 0, losses = 0;
        var any = false;
        foreach (var (idx, score) in sheetScores)
        {
            if (score is not { } s) continue;
            if (!IsSetFinished(idx, s.Our, s.Opp, idx < maxIndex)) continue;
            any = true;
            if (s.Our > s.Opp) wins++;
            else if (s.Opp > s.Our) losses++;
        }
        return any ? (wins, losses) : null;
    }

    /// <summary>
    /// 不管有沒有打完，把每局領先的一方都算贏（比賽紀錄編輯頁存檔時就是這樣算的）；沒有任何局分回 null。
    /// 用來辨識「編輯頁在某局還沒打完時存檔」留下的局勝數，避免被誤當成手填值。
    /// </summary>
    public static (int Wins, int Losses)? TallyAllSets(IReadOnlyDictionary<int, (int Our, int Opp)?> sheetScores)
    {
        int wins = 0, losses = 0;
        var any = false;
        foreach (var score in sheetScores.Values)
        {
            if (score is not { } s) continue;
            any = true;
            if (s.Our > s.Opp) wins++;
            else if (s.Opp > s.Our) losses++;
        }
        return any ? (wins, losses) : null;
    }

    /// <summary>依局勝數判定勝負：多者勝、少者負、相同（且非 0:0）為平；無資料回 null。</summary>
    public static string? ResultFromTally((int Wins, int Losses)? tally)
    {
        if (tally is not { } t) return null;
        if (t.Wins > t.Losses) return "W";
        if (t.Losses > t.Wins) return "L";
        return t.Wins > 0 ? "D" : null;
    }

    /// <summary>
    /// 依記錄單更新局勝數（OurScore/OpponentScore）與 Result，但只動「空白」或「先前自動算出」的值：
    /// 若目前值等於本次存檔前任一種自動算法的結果（oldTallies：記錄單算法、編輯頁算法），視為自動值可更新；
    /// 否則視為手動填寫，保留不動。
    /// </summary>
    public static void ApplyMatchTotals(
        MatchLog log, IReadOnlyCollection<(int Wins, int Losses)?> oldTallies, (int Wins, int Losses)? newTally)
    {
        var scoreIsAuto =
            (log.OurScore == null && log.OpponentScore == null)
            || oldTallies.Any(t => t is { } o && log.OurScore == o.Wins && log.OpponentScore == o.Losses);
        if (scoreIsAuto)
        {
            log.OurScore = newTally?.Wins;
            log.OpponentScore = newTally?.Losses;
        }

        var resultIsAuto = log.Result == null
            || oldTallies.Any(t => ResultFromTally(t) is { } r && log.Result == r);
        if (resultIsAuto)
        {
            log.Result = ResultFromTally(newTally);
        }
    }
}
