namespace VolleyballTrainingTracker.Server.Entities;

public class CryingLog
{
    public int Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public int CrierPlayerId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public Player? Crier { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<CryingLogCulprit> Culprits { get; set; } = new List<CryingLogCulprit>();
}
