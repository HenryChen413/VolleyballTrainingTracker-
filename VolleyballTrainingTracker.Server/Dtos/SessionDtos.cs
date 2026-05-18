using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class SessionListItemDto
{
    public int Id { get; set; }
    public DateTime SessionDate { get; set; }
    public string? StartTime { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
}

public class SessionDto
{
    public int Id { get; set; }
    public DateTime SessionDate { get; set; }
    public string? StartTime { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public List<SessionDrillDto> Drills { get; set; } = new();
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class SessionDrillDto
{
    public int DrillId { get; set; }
    public string DrillName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

public class SessionUpsertRequest
{
    [Required]
    public DateTime SessionDate { get; set; }

    public string? StartTime { get; set; }

    [StringLength(128)]
    public string? Location { get; set; }

    [StringLength(1024)]
    public string? Notes { get; set; }

    public List<int>? DrillIds { get; set; }
}

public class DrillDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class DrillUpsertRequest
{
    [Required, StringLength(64)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(32)]
    public string Category { get; set; } = string.Empty;

    [StringLength(512)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}
