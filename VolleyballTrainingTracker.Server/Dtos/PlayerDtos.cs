using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class PlayerDto
{
    public int Id { get; set; }
    public int? UserId { get; set; }
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
    public byte IsActive { get; set; } // 1=現役 / 0=畢業 / 2=退隊
    public string? Notes { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class PlayerUpsertRequest
{
    public int? UserId { get; set; }

    [Required, StringLength(64)]
    public string Name { get; set; } = string.Empty;

    [StringLength(32)]
    public string? Nickname { get; set; }

    [Range(0, 99)]
    public int? JerseyNo { get; set; }

    [StringLength(64)]
    public string? Position { get; set; }

    [Range(100, 250)]
    public int? HeightCm { get; set; }

    [Range(30, 200)]
    public int? WeightKg { get; set; }

    [StringLength(8)]
    public string? DominantHand { get; set; }

    public DateTime? BirthDate { get; set; }
    public DateTime? JoinedAt { get; set; }
    public int? Grade { get; set; }

    [Range(0, 2)]
    public byte IsActive { get; set; } = 1; // 1=現役 / 0=畢業 / 2=退隊

    [StringLength(512)]
    public string? Notes { get; set; }
}
