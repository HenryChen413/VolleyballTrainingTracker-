using System.Text.Json;
using VolleyballTrainingTracker.Server.Entities;
using VolleyballTrainingTracker.Server.ScoreSheets;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.ScoreSheets;

public class ScoreSheetRulesTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement.Clone();

    private static JsonElement Rally(string rallyJson) =>
        Json("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":" + rallyJson + "}");

    [Fact]
    public void ValidateContent_Minimal_IsValid()
    {
        Assert.Null(ScoreSheetRules.ValidateContent(Rally("[]")));
    }

    [Fact]
    public void ValidateContent_WithRowsAndCounts_IsValid()
    {
        var c = Json("{\"lineup\":[1,null,null,null,null,null],\"rows\":[{\"playerId\":1,\"name\":\"A\",\"counts\":{\"atkO\":3}}],\"oppErrors\":1,\"ourErrors\":2,\"rally\":[\"U\",\"TO\"]}");
        Assert.Null(ScoreSheetRules.ValidateContent(c));
    }

    [Fact]
    public void ValidateContent_WithLiberos_IsValid()
    {
        var c = Json("{\"lineup\":[null,null,null,null,null,null],\"liberos\":[5,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}");
        Assert.Null(ScoreSheetRules.ValidateContent(c));
    }

    [Theory]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"liberos\":[5],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"liberos\":[\"x\",null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"liberos\":null,\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    public void ValidateContent_InvalidLiberos_ReturnsMessage(string json)
    {
        Assert.NotNull(ScoreSheetRules.ValidateContent(Json(json)));
    }

    [Fact]
    public void ValidateContent_WithSubs_IsValid()
    {
        var c = Json("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[],\"subs\":[{\"out\":1,\"in\":3,\"at\":0}]}");
        Assert.Null(ScoreSheetRules.ValidateContent(c));
    }

    [Theory]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[],\"subs\":null}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[],\"subs\":[1]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[],\"subs\":[{\"out\":1,\"at\":0}]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[],\"subs\":[{\"out\":1,\"in\":-3,\"at\":0}]}")]
    public void ValidateContent_InvalidSubs_ReturnsMessage(string json)
    {
        Assert.NotNull(ScoreSheetRules.ValidateContent(Json(json)));
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[\"X\"]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null],\"rows\":[],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[{\"playerId\":1,\"counts\":{\"atkO\":-1}}],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[{\"playerId\":1,\"counts\":{\"atkO\":1.5}}],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[],\"oppErrors\":-1,\"ourErrors\":0,\"rally\":[]}")]
    [InlineData("{\"lineup\":[null,null,null,null,null,null],\"rows\":[{\"counts\":{}}],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}")]
    public void ValidateContent_Invalid_ReturnsMessage(string json)
    {
        Assert.NotNull(ScoreSheetRules.ValidateContent(Json(json)));
    }

    [Fact]
    public void ValidateContent_TooLarge_ReturnsMessage()
    {
        var name = new string('a', 200);
        var rows = string.Join(",", Enumerable.Range(1, 400).Select(i => "{\"playerId\":" + i + ",\"name\":\"" + name + "\",\"counts\":{}}"));
        var c = Json("{\"lineup\":[null,null,null,null,null,null],\"rows\":[" + rows + "],\"oppErrors\":0,\"ourErrors\":0,\"rally\":[]}");
        Assert.True(c.GetRawText().Length > ScoreSheetRules.MaxContentBytes);
        Assert.NotNull(ScoreSheetRules.ValidateContent(c));
    }

    [Theory]
    [InlineData(1, 0, true)]
    [InlineData(2, 1, true)]
    [InlineData(3, 1, false)]
    [InlineData(1, 1, false)]
    [InlineData(51, 50, false)]
    [InlineData(0, 0, false)]
    public void ValidateNewSetIndex(int setIndex, int currentMax, bool ok)
    {
        var r = ScoreSheetRules.ValidateNewSetIndex(setIndex, currentMax);
        if (ok) Assert.Null(r); else Assert.NotNull(r);
    }

    [Theory]
    [InlineData(3, 3, true)]
    [InlineData(2, 3, false)]
    public void CanDelete(int setIndex, int currentMax, bool expected)
    {
        Assert.Equal(expected, ScoreSheetRules.CanDelete(setIndex, currentMax));
    }

    [Fact]
    public void ComputeFinalScore_CountsPointsIgnoringTimeouts()
    {
        Assert.Equal((3, 1), ScoreSheetRules.ComputeFinalScore(Rally("[\"U\",\"U\",\"TO\",\"O\",\"U\"]")));
    }

    [Fact]
    public void ComputeFinalScore_OnlyTimeouts_ReturnsNull()
    {
        Assert.Null(ScoreSheetRules.ComputeFinalScore(Rally("[\"TU\",\"TO\"]")));
    }

    [Fact]
    public void ComputeFinalScore_Empty_ReturnsNull()
    {
        Assert.Null(ScoreSheetRules.ComputeFinalScore(Rally("[]")));
    }

    [Fact]
    public void ApplyBackfill_Official_Set2_WritesSet2Columns()
    {
        var log = new MatchLog { Set1Our = 25, Set1Opp = 10, Set3Our = 7, Set3Opp = 8 };
        ScoreSheetRules.ApplyBackfill(log, "Official", 2, 25, 18);
        Assert.Equal(25, log.Set2Our);
        Assert.Equal(18, log.Set2Opp);
        Assert.Equal(25, log.Set1Our);
        Assert.Equal(10, log.Set1Opp);
        Assert.Equal(7, log.Set3Our);
        Assert.Equal(8, log.Set3Opp);
    }

    [Fact]
    public void ApplyBackfill_NullMatchType_TreatedAsOfficial()
    {
        var log = new MatchLog();
        ScoreSheetRules.ApplyBackfill(log, null, 1, 25, 20);
        Assert.Equal(25, log.Set1Our);
        Assert.Equal(20, log.Set1Opp);
        Assert.Empty(log.Sets);
    }

    [Fact]
    public void ApplyBackfill_Official_Set4_DoesNothing()
    {
        var log = new MatchLog();
        ScoreSheetRules.ApplyBackfill(log, "Official", 4, 25, 20);
        Assert.Null(log.Set1Our);
        Assert.Null(log.Set2Our);
        Assert.Null(log.Set3Our);
        Assert.Empty(log.Sets);
    }

    [Fact]
    public void ApplyBackfill_Friendly_AddsMissingSet()
    {
        var log = new MatchLog();
        ScoreSheetRules.ApplyBackfill(log, "Friendly", 5, 25, 20);
        var s = Assert.Single(log.Sets);
        Assert.Equal(5, s.SetIndex);
        Assert.Equal(25, s.OurScore);
        Assert.Equal(20, s.OpponentScore);
    }

    [Fact]
    public void ApplyBackfill_Friendly_UpdatesExistingSet()
    {
        var log = new MatchLog();
        log.Sets.Add(new MatchLogSet { SetIndex = 2, OurScore = 10, OpponentScore = 10 });
        ScoreSheetRules.ApplyBackfill(log, "Friendly", 2, 25, 20);
        var s = Assert.Single(log.Sets);
        Assert.Equal(25, s.OurScore);
        Assert.Equal(20, s.OpponentScore);
    }

    [Fact]
    public void ApplyBackfill_DoesNotTouchTotalsOrResult()
    {
        var log = new MatchLog { OurScore = 2, OpponentScore = 1, Result = "W" };
        ScoreSheetRules.ApplyBackfill(log, "Official", 1, 25, 20);
        ScoreSheetRules.ApplyBackfill(log, "Friendly", 2, 25, 20);
        Assert.Equal(2, log.OurScore);
        Assert.Equal(1, log.OpponentScore);
        Assert.Equal("W", log.Result);
    }

    private static Dictionary<int, (int Our, int Opp)?> Sheets(params (int Idx, int Our, int Opp)[] sets) =>
        sets.ToDictionary(s => s.Idx, s => (s.Our == 0 && s.Opp == 0) ? null : ((int, int)?)(s.Our, s.Opp));

    [Theory]
    [InlineData(1, 25, 23, false, true)]
    [InlineData(1, 25, 24, false, false)]   // 領先不足 2 分
    [InlineData(1, 27, 25, false, true)]    // Deuce 後
    [InlineData(2, 15, 10, false, false)]   // 第 2 局要 25 分
    [InlineData(3, 15, 10, false, true)]    // 決勝局 15 分
    [InlineData(1, 12, 8, false, false)]    // 還在打
    [InlineData(1, 12, 8, true, true)]      // 已經有下一局
    public void IsSetFinished(int idx, int our, int opp, bool hasLater, bool expected)
    {
        Assert.Equal(expected, ScoreSheetRules.IsSetFinished(idx, our, opp, hasLater));
    }

    [Fact]
    public void TallyFinishedSets_IgnoresLastSetInProgress()
    {
        // 第 1 局贏、第 2 局輸、第 3 局 8:5 還在打
        var t = ScoreSheetRules.TallyFinishedSets(Sheets((1, 25, 20), (2, 18, 25), (3, 8, 5)));
        Assert.Equal((1, 1), t);
    }

    [Fact]
    public void TallyFinishedSets_CountsFinishedDecidingSet()
    {
        var t = ScoreSheetRules.TallyFinishedSets(Sheets((1, 25, 20), (2, 18, 25), (3, 15, 12)));
        Assert.Equal((2, 1), t);
    }

    [Fact]
    public void TallyFinishedSets_SetFinishedByNextSheetEvenIfEmpty()
    {
        // 第 1 局 21:15（友誼賽 21 分制）已開了第 2 局（尚未記分）
        var t = ScoreSheetRules.TallyFinishedSets(Sheets((1, 21, 15), (2, 0, 0)));
        Assert.Equal((1, 0), t);
    }

    [Fact]
    public void TallyFinishedSets_NothingFinished_ReturnsNull()
    {
        Assert.Null(ScoreSheetRules.TallyFinishedSets(Sheets((1, 10, 3))));
        Assert.Null(ScoreSheetRules.TallyFinishedSets(new Dictionary<int, (int, int)?>()));
    }

    [Theory]
    [InlineData(2, 1, "W")]
    [InlineData(1, 2, "L")]
    [InlineData(1, 1, "D")]
    [InlineData(0, 0, null)]
    public void ResultFromTally(int w, int l, string? expected)
    {
        Assert.Equal(expected, ScoreSheetRules.ResultFromTally((w, l)));
    }

    private static (int, int)?[] Old((int, int)? tally) => new[] { tally };

    [Fact]
    public void TallyAllSets_CountsUnfinishedLeader()
    {
        Assert.Equal((2, 0), ScoreSheetRules.TallyAllSets(Sheets((1, 25, 20), (2, 10, 5))));
        Assert.Null(ScoreSheetRules.TallyAllSets(Sheets((1, 0, 0))));
    }

    [Fact]
    public void ApplyMatchTotals_EditPageSavedMidSet_StillUpdates()
    {
        // 第 3 局 10:5 進行中時，編輯頁存檔把它算成贏 → 存了 1:2 負（記錄單算法是 0:2）
        var before = Sheets((1, 15, 25), (2, 20, 25), (3, 10, 5));
        var log = new MatchLog { OurScore = 1, OpponentScore = 2, Result = "L" };
        var oldTallies = new[] { ScoreSheetRules.TallyFinishedSets(before), ScoreSheetRules.TallyAllSets(before) };
        // 之後第 3 局 26:24 打完、開了第 4 局 25:21
        var after = Sheets((1, 15, 25), (2, 20, 25), (3, 26, 24), (4, 25, 21));
        ScoreSheetRules.ApplyMatchTotals(log, oldTallies, ScoreSheetRules.TallyFinishedSets(after));
        Assert.Equal(2, log.OurScore);
        Assert.Equal(2, log.OpponentScore);
        Assert.Equal("D", log.Result);
    }

    [Fact]
    public void ApplyMatchTotals_StaleThreeSetTotals_UpdatedThroughSet8()
    {
        // 鳳中女排：編輯頁在第 3 局後存成 1:2 負，之後記錄單第 4～8 局陸續存檔
        var scores = new (int, int, int)[]
        {
            (1, 15, 25), (2, 20, 25), (3, 26, 24), (4, 25, 21),
            (5, 26, 24), (6, 24, 26), (7, 25, 21), (8, 25, 22),
        };
        var log = new MatchLog { OurScore = 1, OpponentScore = 2, Result = "L" };
        for (var n = 4; n <= 8; n++)
        {
            var before = Sheets(scores.Take(n - 1).ToArray());
            var after = Sheets(scores.Take(n).ToArray());
            var oldTallies = new[] { ScoreSheetRules.TallyFinishedSets(before), ScoreSheetRules.TallyAllSets(before) };
            ScoreSheetRules.ApplyMatchTotals(log, oldTallies, ScoreSheetRules.TallyFinishedSets(after));
        }
        Assert.Equal(5, log.OurScore);
        Assert.Equal(3, log.OpponentScore);
        Assert.Equal("W", log.Result);
    }

    [Fact]
    public void ApplyMatchTotals_FillsEmpty()
    {
        var log = new MatchLog();
        ScoreSheetRules.ApplyMatchTotals(log, Old(null), (2, 1));
        Assert.Equal(2, log.OurScore);
        Assert.Equal(1, log.OpponentScore);
        Assert.Equal("W", log.Result);
    }

    [Fact]
    public void ApplyMatchTotals_UpdatesPreviouslyAutoValues()
    {
        // 上次自動算出 1:0 勝，這次 1:1 → 平，再下一次 1:2 → 負
        var log = new MatchLog { OurScore = 1, OpponentScore = 0, Result = "W" };
        ScoreSheetRules.ApplyMatchTotals(log, Old((1, 0)), (1, 1));
        Assert.Equal(1, log.OurScore);
        Assert.Equal(1, log.OpponentScore);
        Assert.Equal("D", log.Result);
        ScoreSheetRules.ApplyMatchTotals(log, Old((1, 1)), (1, 2));
        Assert.Equal(2, log.OpponentScore);
        Assert.Equal("L", log.Result);
    }

    [Fact]
    public void ApplyMatchTotals_KeepsManualValues()
    {
        // 手動填 3:1 勝（正式賽打到第 4 局），記錄單只算得到 2:1
        var log = new MatchLog { OurScore = 3, OpponentScore = 1, Result = "W" };
        ScoreSheetRules.ApplyMatchTotals(log, Old((1, 1)), (2, 1));
        Assert.Equal(3, log.OurScore);
        Assert.Equal(1, log.OpponentScore);
        Assert.Equal("W", log.Result);
    }

    [Fact]
    public void ApplyMatchTotals_ManualResultKeptWhileScoreFilled()
    {
        // 只手動按了「負」、大比分空白 → 補大比分，勝負保留
        var log = new MatchLog { Result = "L" };
        ScoreSheetRules.ApplyMatchTotals(log, Old(null), (1, 0));
        Assert.Equal(1, log.OurScore);
        Assert.Equal(0, log.OpponentScore);
        Assert.Equal("L", log.Result);
    }
}
