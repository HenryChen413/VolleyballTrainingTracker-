namespace VolleyballTrainingTracker.Server.Entities;

public class User
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public Role? Role { get; set; }
    public string? DisplayName { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public ICollection<Player> Players { get; set; } = new List<Player>();
    public ICollection<TrainingSession> CoachedSessions { get; set; } = new List<TrainingSession>();
}
