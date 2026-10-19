namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 全隊共用站位（防守／接發）：一套站位存成一筆，內容為 jsonb 文件。
/// Key 固定為 defense / receive-opp / receive-2oh；Layout 結構由前端解析器負責。
/// Version 每次儲存 +1，作為樂觀並行控制（避免兩人同時編輯互相覆蓋）。
/// </summary>
public class Formation
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Layout { get; set; } = "{}";
    public int Version { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
}
