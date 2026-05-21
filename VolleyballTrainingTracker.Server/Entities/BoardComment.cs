namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 留言板回覆（單層，不巢狀）。作者即 CreatedByUserId。
/// 隨貼文 ON DELETE CASCADE 一併移除。
/// </summary>
public class BoardComment
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    public BoardPost? Post { get; set; }
    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
}
