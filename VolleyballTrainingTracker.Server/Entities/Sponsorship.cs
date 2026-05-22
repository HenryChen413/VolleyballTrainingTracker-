namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 一筆隊費贊助紀錄，連結到贊助者名冊（Sponsor）。金額單位為「元」。
/// </summary>
public class Sponsorship
{
    public int Id { get; set; }
    public int SponsorId { get; set; }

    /// <summary>贊助金額（元，必為正整數）。</summary>
    public int Amount { get; set; }

    public DateTime OccurredAt { get; set; }

    /// <summary>用途（隊服、場租…），選填。</summary>
    public string? Purpose { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public Sponsor? Sponsor { get; set; }
    public User? UpdatedByUser { get; set; }
}
