namespace VolleyballTrainingTracker.Server.Entities;

public class MatchEventPlayer
{
    public int MatchEventId { get; set; }
    public int PlayerId { get; set; }
    public DateTime CreatedAt { get; set; }

    // 球員所屬分隊（NULL = 未指定，"A" / "B" 等）
    public string? OurSquad { get; set; }

    // Snapshot — 寫入時凍結，之後 Player 表變動不影響此紀錄
    public string PlayerName { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
    public string? Position { get; set; }

    public MatchEvent? MatchEvent { get; set; }
    public Player? Player { get; set; }
}
