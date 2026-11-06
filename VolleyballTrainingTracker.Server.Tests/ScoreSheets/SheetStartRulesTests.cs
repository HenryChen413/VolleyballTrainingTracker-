using VolleyballTrainingTracker.Server.ScoreSheets;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.ScoreSheets;

public class SheetStartRulesTests
{
    [Fact]
    public void Normalize_SingleSquad_TrimsOpponentAndIgnoresSquad()
    {
        var r = SheetStartRules.Normalize("  高醫大  ", "A", squadCount: 1);
        Assert.Null(r.Error);
        Assert.Equal("高醫大", r.Opponent);
        Assert.Null(r.Squad);
    }

    [Theory]
    [InlineData("A")]
    [InlineData("B")]
    [InlineData(" b ")]
    public void Normalize_SplitSquad_AcceptsAOrB(string squad)
    {
        var r = SheetStartRules.Normalize("成大", squad, squadCount: 2);
        Assert.Null(r.Error);
        Assert.Equal(squad.Trim().ToUpperInvariant(), r.Squad);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("C")]
    public void Normalize_SplitSquad_RequiresAOrB(string? squad)
    {
        Assert.NotNull(SheetStartRules.Normalize("成大", squad, squadCount: 2).Error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Normalize_EmptyOpponent_ReturnsError(string? opponent)
    {
        Assert.NotNull(SheetStartRules.Normalize(opponent, null, squadCount: 1).Error);
    }

    [Fact]
    public void Normalize_OpponentTooLong_ReturnsError()
    {
        Assert.NotNull(SheetStartRules.Normalize(new string('x', 129), null, squadCount: 1).Error);
        Assert.Null(SheetStartRules.Normalize(new string('x', 128), null, squadCount: 1).Error);
    }

    [Theory]
    [InlineData("高醫大", "高醫大", true)]
    [InlineData(" 高醫大 ", "高醫大", true)]
    [InlineData("KMU", "kmu", true)]
    [InlineData("高醫大", "高醫", false)]
    public void SameOpponent_IgnoresCaseAndSurroundingSpace(string a, string b, bool expected)
    {
        Assert.Equal(expected, SheetStartRules.SameOpponent(a, b));
    }

    [Theory]
    [InlineData(new int[0], 1)]
    [InlineData(new[] { 1 }, 2)]
    [InlineData(new[] { 1, 2, 3 }, 4)]
    public void NextSetIndex_IsMaxPlusOne(int[] existing, int expected)
    {
        Assert.Equal(expected, SheetStartRules.NextSetIndex(existing));
    }
}
