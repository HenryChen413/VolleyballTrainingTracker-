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
}
