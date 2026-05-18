using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class RoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> AllowedPages { get; set; } = new();
    public List<string> Permissions { get; set; } = new();
    public bool IsSystem { get; set; }
    public int UserCount { get; set; }
}

public class RoleUpsertRequest
{
    [Required, StringLength(32, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(256)]
    public string? Description { get; set; }

    public List<string> AllowedPages { get; set; } = new();
    public List<string> Permissions { get; set; } = new();
}

public class RoleCatalogDto
{
    public List<string> AllPermissions { get; set; } = new();
    public List<string> AllPages { get; set; } = new();
}
