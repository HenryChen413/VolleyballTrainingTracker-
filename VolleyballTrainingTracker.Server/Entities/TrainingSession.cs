namespace VolleyballTrainingTracker.Server.Entities;

public class TrainingSession
{
    public int Id { get; set; }
    public DateTime SessionDate { get; set; }
    public TimeSpan? StartTime { get; set; }
    public int? DurationMin { get; set; }
    public string? Location { get; set; }
    public string? Theme { get; set; }
    public int CoachUserId { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? Coach { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<SessionDrill> SessionDrills { get; set; } = new List<SessionDrill>();
}
