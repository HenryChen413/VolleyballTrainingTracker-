namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 貼文層級的按讚／表情：每位使用者對同一貼文的同一 Emoji 僅一筆（partial unique）。
/// 採此設計可天然防重複按讚，並可日後擴充多種表情。
/// </summary>
public class BoardReaction
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public int UserId { get; set; }
    public string Emoji { get; set; } = "❤";
    public DateTime CreatedAt { get; set; }

    public BoardPost? Post { get; set; }
    public User? User { get; set; }
}
