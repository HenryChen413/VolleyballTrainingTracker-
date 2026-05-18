namespace VolleyballTrainingTracker.Server.Entities;

public class Drill
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? UpdatedByUser { get; set; }
    public ICollection<SessionDrill> SessionDrills { get; set; } = new List<SessionDrill>();
}
