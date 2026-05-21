namespace VolleyballTrainingTracker.Server.Dtos;

/// <summary>留言板貼文（含其回覆與按讚摘要）。</summary>
public class BoardPostDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public int? AuthorUserId { get; set; }          // = CreatedByUserId
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool Edited { get; set; }                // UpdatedAt 非空
    public int ReactionCount { get; set; }
    public bool ReactedByMe { get; set; }
    public int CommentCount { get; set; }
    public List<BoardCommentDto> Comments { get; set; } = new();
    // 前端便利欄位：依當前使用者計算（本人 or 管理）
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
}

/// <summary>留言板回覆（單層）。</summary>
public class BoardCommentDto
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int? AuthorUserId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool Edited { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
}

/// <summary>分頁清單回傳。</summary>
public class BoardListDto
{
    public List<BoardPostDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore { get; set; }
}

public class BoardPostUpsertRequest
{
    public string Content { get; set; } = string.Empty;
}

public class BoardCommentUpsertRequest
{
    public string Content { get; set; } = string.Empty;
}

public class BoardReactionRequest
{
    /// <summary>表情；省略時預設為愛心。</summary>
    public string? Emoji { get; set; }
}
