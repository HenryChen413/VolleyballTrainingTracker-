namespace VolleyballTrainingTracker.Server.Entities;

public class MatchLog
{
    public int Id { get; set; }
    public int MatchEventId { get; set; }
    public string Opponent { get; set; } = string.Empty;
    public string? OurSquad { get; set; }
    public int? Set1Our { get; set; }
    public int? Set1Opp { get; set; }
    public int? Set2Our { get; set; }
    public int? Set2Opp { get; set; }
    public int? Set3Our { get; set; }
    public int? Set3Opp { get; set; }
    public int? OurScore { get; set; }
    public int? OpponentScore { get; set; }
    public string? Result { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public MatchEvent? MatchEvent { get; set; }
    public User? UpdatedByUser { get; set; }
}
