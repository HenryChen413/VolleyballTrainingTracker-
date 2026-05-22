using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

/// <summary>
/// 贊助者名冊項目（含累計統計）。贊助者可連結球員或為陣容外人士。
/// </summary>
public class SponsorDto
{
    public int Id { get; set; }
    public int? PlayerId { get; set; }
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>身分：0=學姊 1=學長 2=家長 3=廠商 4=其他。</summary>
    public short Identity { get; set; }
    public string? Notes { get; set; }

    /// <summary>連結球員時的背號；外部人士為 null。</summary>
    public int? JerseyNo { get; set; }

    /// <summary>此贊助者累計贊助總額（元）。</summary>
    public int TotalAmount { get; set; }

    /// <summary>此贊助者的贊助筆數。</summary>
    public int Count { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class SponsorUpsertRequest
{
    /// <summary>連結球員（可空）。連結後 DisplayName 仍以本欄位送出值為準。</summary>
    public int? PlayerId { get; set; }

    [Required]
    [StringLength(64, MinimumLength = 1)]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>身分：0=學姊 1=學長 2=家長 3=廠商 4=其他。</summary>
    [Range(0, 4)]
    public short Identity { get; set; }

    [StringLength(256)]
    public string? Notes { get; set; }
}

/// <summary>
/// 一筆贊助紀錄（含贊助者顯示資訊，方便清單直接呈現）。
/// </summary>
public class SponsorshipDto
{
    public int Id { get; set; }
    public int SponsorId { get; set; }
    public string SponsorName { get; set; } = string.Empty;
    public short SponsorIdentity { get; set; }
    public int? SponsorJerseyNo { get; set; }

    public int Amount { get; set; }
    public DateTime OccurredAt { get; set; }
    public string? Purpose { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class SponsorshipUpsertRequest
{
    [Required]
    public int SponsorId { get; set; }

    [Range(1, int.MaxValue)]
    public int Amount { get; set; }

    [Required]
    public DateTime OccurredAt { get; set; }

    [StringLength(128)]
    public string? Purpose { get; set; }

    [StringLength(256)]
    public string? Notes { get; set; }
}

/// <summary>贊助芳名榜排行項目（依累計金額）。</summary>
public class SponsorRankDto
{
    public int SponsorId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public short Identity { get; set; }
    public int? JerseyNo { get; set; }
    public int TotalAmount { get; set; }
    public int Count { get; set; }
}

public class SponsorStatsDto
{
    /// <summary>所有贊助紀錄總金額（元）。</summary>
    public int TotalAmount { get; set; }

    /// <summary>贊助紀錄總筆數。</summary>
    public int TotalCount { get; set; }

    /// <summary>有贊助紀錄的贊助者人數。</summary>
    public int SponsorCount { get; set; }

    /// <summary>芳名榜：依累計金額排序。</summary>
    public List<SponsorRankDto> TopSponsors { get; set; } = new();

    /// <summary>最近常用的用途，供表單快速填入。</summary>
    public List<string> RecentPurposes { get; set; } = new();
}
