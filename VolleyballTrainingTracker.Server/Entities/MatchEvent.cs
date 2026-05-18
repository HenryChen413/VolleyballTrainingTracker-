namespace VolleyballTrainingTracker.Server.Entities;

public class MatchEvent
{
    public int Id { get; set; }
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public int? AcademicYear { get; set; }
    public string? MatchName { get; set; }
    public string? Location { get; set; }
    public string? Ranking { get; set; }
    public string? RankingB { get; set; }
    public string? VideoUrl { get; set; }
    public string? Notes { get; set; }
    public int SquadCount { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? UpdatedByUser { get; set; }
    public ICollection<MatchLog> Matches { get; set; } = new List<MatchLog>();
    public ICollection<MatchEventPlayer> Players { get; set; } = new List<MatchEventPlayer>();
}
