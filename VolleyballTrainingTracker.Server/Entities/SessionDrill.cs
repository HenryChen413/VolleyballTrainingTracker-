namespace VolleyballTrainingTracker.Server.Entities;

public class SessionDrill
{
    public int SessionId { get; set; }
    public int DrillId { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedByUserId { get; set; }

    public TrainingSession? Session { get; set; }
    public Drill? Drill { get; set; }
}
