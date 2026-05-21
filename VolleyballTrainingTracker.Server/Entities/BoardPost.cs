namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 留言板貼文（純文字）。作者即 CreatedByUserId（由 AppDbContext 自動寫入）。
/// 採軟刪除（IsDeleted）；硬刪除仍會經 AppDbContext 寫入 AuditDeletes。
/// </summary>
public class BoardPost
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<BoardComment> Comments { get; set; } = new List<BoardComment>();
    public ICollection<BoardReaction> Reactions { get; set; } = new List<BoardReaction>();
}
