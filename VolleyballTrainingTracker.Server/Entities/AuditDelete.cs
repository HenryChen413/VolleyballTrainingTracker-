namespace VolleyballTrainingTracker.Server.Entities;

public class AuditDelete
{
    public long Id { get; set; }
    public string TableName { get; set; } = string.Empty;
    public int RowId { get; set; }
    public int? DeletedByUserId { get; set; }
    public DateTime DeletedAt { get; set; }
    public string? RowJson { get; set; }

    public User? DeletedBy { get; set; }
}
