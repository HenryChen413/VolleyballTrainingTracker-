namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 友誼賽局分子表：當 MatchEvent.MatchType=Friendly 時使用，可承載 1~N 局。
/// Official 賽事不寫入此表，沿用 MatchLog 的 Set1/2/3 欄位。
/// </summary>
public class MatchLogSet
{
    public int Id { get; set; }
    public int MatchLogId { get; set; }
    public short SetIndex { get; set; }
    public int OurScore { get; set; }
    public int OpponentScore { get; set; }

    public MatchLog? MatchLog { get; set; }
}
