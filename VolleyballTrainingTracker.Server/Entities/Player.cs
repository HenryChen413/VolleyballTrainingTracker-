namespace VolleyballTrainingTracker.Server.Entities;

public class Player
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? StudentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Nickname { get; set; }
    public int? JerseyNo { get; set; }
    public string? Position { get; set; }
    public int? HeightCm { get; set; }
    public int? WeightKg { get; set; }
    public string? DominantHand { get; set; }
    public DateTime? BirthDate { get; set; }
    public DateTime JoinedAt { get; set; }
    public int? Grade { get; set; }
    public byte IsActive { get; set; } = 1; // 1=現役 / 0=畢業 / 2=退隊
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? User { get; set; }
    public User? UpdatedByUser { get; set; }
}
