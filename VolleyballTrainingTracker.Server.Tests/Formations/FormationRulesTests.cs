using System.Text.Json;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Formations;
using Xunit;

namespace VolleyballTrainingTracker.Server.Tests.Formations;

public class FormationRulesTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement.Clone();

    [Theory]
    [InlineData("defense", Pages.Defense)]
    [InlineData("receive-opp", Pages.Receive)]
    [InlineData("receive-2oh", Pages.Receive)]
    public void PageForKey_KnownKeys(string key, string page)
    {
        Assert.Equal(page, FormationRules.PageForKey(key));
    }

    [Theory]
    [InlineData("offense")]
    [InlineData("Defense")]
    [InlineData("")]
    public void PageForKey_UnknownKey_ReturnsNull(string key)
    {
        Assert.Null(FormationRules.PageForKey(key));
    }

    [Fact]
    public void ValidateLayout_ObjectWithVersion1_IsValid()
    {
        Assert.Null(FormationRules.ValidateLayout(Json("{\"version\":1,\"bases\":{}}")));
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("\"text\"")]
    [InlineData("{}")]
    [InlineData("{\"version\":2}")]
    [InlineData("{\"version\":\"1\"}")]
    [InlineData("{\"version\":1.5}")]
    public void ValidateLayout_Invalid_ReturnsError(string json)
    {
        Assert.NotNull(FormationRules.ValidateLayout(Json(json)));
    }

    [Fact]
    public void ValidateLayout_Undefined_ReturnsError()
    {
        Assert.NotNull(FormationRules.ValidateLayout(default));
    }

    [Fact]
    public void ValidateLayout_TooLarge_ReturnsError()
    {
        var big = new string('a', FormationRules.MaxLayoutBytes);
        Assert.NotNull(FormationRules.ValidateLayout(Json($"{{\"version\":1,\"pad\":\"{big}\"}}")));
    }
}
