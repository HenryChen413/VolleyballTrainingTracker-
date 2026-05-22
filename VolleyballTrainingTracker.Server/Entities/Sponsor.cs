namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 贊助者名冊：可連結現役/畢業球員（PlayerId），或為陣容外的外部人士（學長姊/家長/廠商）。
/// 同一位贊助者多次贊助時，靠此主檔正確累計排名與顯示。
/// </summary>
public class Sponsor
{
    public int Id { get; set; }

    /// <summary>連結到球員（現役/畢業/離隊皆可）；外部人士留空。</summary>
    public int? PlayerId { get; set; }

    /// <summary>顯示名稱：球員可同步其姓名，外部人士自填。</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>身分：0=學姊 1=學長 2=家長 3=廠商 4=其他。</summary>
    public short Identity { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public Player? Player { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<Sponsorship> Sponsorships { get; set; } = new List<Sponsorship>();
}
