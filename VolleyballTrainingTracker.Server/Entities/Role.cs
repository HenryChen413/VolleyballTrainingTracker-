namespace VolleyballTrainingTracker.Server.Entities;

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>JSON array of page identifiers, e.g. ["dashboard","players"]</summary>
    public string AllowedPages { get; set; } = "[]";

    /// <summary>JSON array of permission strings, e.g. ["players.create",...]</summary>
    public string Permissions { get; set; } = "[]";

    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
}
