namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 比賽記錄單：一場比賽（MatchLog）的每一局一筆，內容為 jsonb 文件（先發、個人數據、失誤、逐分 rally）。
/// Version 每次儲存 +1，作為樂觀並行控制（避免兩人同時記錄互相覆蓋）。
/// </summary>
public class MatchScoreSheet
{
    public int Id { get; set; }
    public int MatchLogId { get; set; }
    public short SetIndex { get; set; }
    public string? RecorderName { get; set; }
    public string Content { get; set; } = "{}";
    public int Version { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public MatchLog? MatchLog { get; set; }
    public User? UpdatedByUser { get; set; }
}
