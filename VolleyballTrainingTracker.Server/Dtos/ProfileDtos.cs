using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class ProfileUpdateRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [StringLength(64)]
    public string? DisplayName { get; set; }
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(64, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>目前登入者所綁定的選手檔案（唯讀，供「我的帳號」頁顯示）。</summary>
public class MyPlayerInfo
{
    public int Id { get; set; }
    public string? StudentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Nickname { get; set; }
    public int? JerseyNo { get; set; }
    public string? Position { get; set; }
    public int? HeightCm { get; set; }
    public int? WeightKg { get; set; }
    public string? DominantHand { get; set; }
    public int? Grade { get; set; }
    public byte IsActive { get; set; }
    public DateTime JoinedAt { get; set; }

    /// <summary>總出賽（含友誼賽）場次</summary>
    public int MatchAppearanceCount { get; set; }
    /// <summary>正式比賽出賽場次</summary>
    public int OfficialAppearanceCount { get; set; }
    public List<MyMatchAppearance> Appearances { get; set; } = new();
}

public class MyMatchAppearance
{
    public int MatchEventId { get; set; }
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public string? MatchName { get; set; }
    public string? OurSquad { get; set; }
}
