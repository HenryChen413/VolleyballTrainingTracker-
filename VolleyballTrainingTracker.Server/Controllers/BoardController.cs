using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 留言板（純文字・動態牆兩層式）。
/// 進入頁面：需 [RequirePage(Pages.Board)]。
/// 一般動作（發文 / 回覆 / 按讚 / 刪自己的）：有頁面權限即可。
/// 刪除他人內容、置頂：需 Permissions.BoardManage。
/// 貼文與回覆採軟刪除（IsDeleted）；按讚為硬刪除（toggle）。
/// </summary>
[ApiController]
[Authorize]
[RequirePage(Pages.Board)]
[Route("api/board")]
public class BoardController : ControllerBase
{
    private const string DefaultEmoji = "❤";
    private const int MaxPostLength = 2000;
    private const int MaxCommentLength = 1000;

    private readonly AppDbContext _db;
    public BoardController(AppDbContext db) => _db = db;

    // ---------- 貼文 ----------

    [HttpGet]
    public async Task<ActionResult<BoardListDto>> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 50) pageSize = 20;

        var me = GetUserId();
        var canManage = CanManage();

        var baseQuery = _db.BoardPosts.Where(p => !p.IsDeleted);
        var total = await baseQuery.CountAsync();

        var posts = await baseQuery
            .OrderByDescending(p => p.IsPinned)
            .ThenByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(p => p.CreatedByUser)
            .Include(p => p.Comments.Where(c => !c.IsDeleted)).ThenInclude(c => c.CreatedByUser)
            .Include(p => p.Reactions)
            .AsSplitQuery()
            .ToListAsync();

        var items = posts.Select(p => ToDto(p, me, canManage)).ToList();

        return Ok(new BoardListDto
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
            HasMore = page * pageSize < total,
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BoardPostDto>> Get(int id)
    {
        var me = GetUserId();
        var canManage = CanManage();
        var post = await LoadPostAsync(id);
        if (post == null || post.IsDeleted) return NotFound();
        return Ok(ToDto(post, me, canManage));
    }

    [HttpPost]
    public async Task<ActionResult<BoardPostDto>> Create([FromBody] BoardPostUpsertRequest req)
    {
        var content = (req.Content ?? string.Empty).Trim();
        if (content.Length == 0) return BadRequest(new { message = "內容不可為空" });
        if (content.Length > MaxPostLength) return BadRequest(new { message = $"內容最長 {MaxPostLength} 字" });

        var post = new BoardPost { Content = content };
        _db.BoardPosts.Add(post);
        await _db.SaveChangesAsync();

        var saved = await LoadPostAsync(post.Id);
        return CreatedAtAction(nameof(Get), new { id = post.Id }, ToDto(saved!, GetUserId(), CanManage()));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BoardPostDto>> Update(int id, [FromBody] BoardPostUpsertRequest req)
    {
        var post = await _db.BoardPosts.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (post == null) return NotFound();
        if (!IsOwner(post.CreatedByUserId)) return Forbid403("僅作者可編輯貼文");

        var content = (req.Content ?? string.Empty).Trim();
        if (content.Length == 0) return BadRequest(new { message = "內容不可為空" });
        if (content.Length > MaxPostLength) return BadRequest(new { message = $"內容最長 {MaxPostLength} 字" });

        post.Content = content;
        await _db.SaveChangesAsync();

        var saved = await LoadPostAsync(post.Id);
        return Ok(ToDto(saved!, GetUserId(), CanManage()));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var post = await _db.BoardPosts.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (post == null) return NotFound();
        if (!IsOwner(post.CreatedByUserId) && !CanManage()) return Forbid403("無權刪除此貼文");

        post.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>置頂／取消置頂（管理權限）。</summary>
    [HttpPost("{id:int}/pin")]
    [RequirePermission(Permissions.BoardManage)]
    public async Task<ActionResult<BoardPostDto>> TogglePin(int id)
    {
        var post = await _db.BoardPosts.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (post == null) return NotFound();

        post.IsPinned = !post.IsPinned;
        await _db.SaveChangesAsync();

        var saved = await LoadPostAsync(post.Id);
        return Ok(ToDto(saved!, GetUserId(), CanManage()));
    }

    // ---------- 回覆 ----------

    [HttpPost("{id:int}/comments")]
    public async Task<ActionResult<BoardCommentDto>> AddComment(int id, [FromBody] BoardCommentUpsertRequest req)
    {
        var postExists = await _db.BoardPosts.AnyAsync(p => p.Id == id && !p.IsDeleted);
        if (!postExists) return NotFound();

        var content = (req.Content ?? string.Empty).Trim();
        if (content.Length == 0) return BadRequest(new { message = "回覆不可為空" });
        if (content.Length > MaxCommentLength) return BadRequest(new { message = $"回覆最長 {MaxCommentLength} 字" });

        var comment = new BoardComment { PostId = id, Content = content };
        _db.BoardComments.Add(comment);
        await _db.SaveChangesAsync();

        var saved = await _db.BoardComments.Include(c => c.CreatedByUser).FirstAsync(c => c.Id == comment.Id);
        return Ok(ToDto(saved, GetUserId(), CanManage()));
    }

    [HttpPut("comments/{commentId:int}")]
    public async Task<ActionResult<BoardCommentDto>> UpdateComment(int commentId, [FromBody] BoardCommentUpsertRequest req)
    {
        var comment = await _db.BoardComments.FirstOrDefaultAsync(c => c.Id == commentId && !c.IsDeleted);
        if (comment == null) return NotFound();
        if (!IsOwner(comment.CreatedByUserId)) return Forbid403("僅作者可編輯回覆");

        var content = (req.Content ?? string.Empty).Trim();
        if (content.Length == 0) return BadRequest(new { message = "回覆不可為空" });
        if (content.Length > MaxCommentLength) return BadRequest(new { message = $"回覆最長 {MaxCommentLength} 字" });

        comment.Content = content;
        await _db.SaveChangesAsync();

        var saved = await _db.BoardComments.Include(c => c.CreatedByUser).FirstAsync(c => c.Id == comment.Id);
        return Ok(ToDto(saved, GetUserId(), CanManage()));
    }

    [HttpDelete("comments/{commentId:int}")]
    public async Task<IActionResult> DeleteComment(int commentId)
    {
        var comment = await _db.BoardComments.FirstOrDefaultAsync(c => c.Id == commentId && !c.IsDeleted);
        if (comment == null) return NotFound();
        if (!IsOwner(comment.CreatedByUserId) && !CanManage()) return Forbid403("無權刪除此回覆");

        comment.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- 按讚（toggle） ----------

    [HttpPost("{id:int}/react")]
    public async Task<ActionResult<BoardPostDto>> ToggleReaction(int id, [FromBody] BoardReactionRequest? req = null)
    {
        var me = GetUserId();
        if (me == null) return Unauthorized();

        var postExists = await _db.BoardPosts.AnyAsync(p => p.Id == id && !p.IsDeleted);
        if (!postExists) return NotFound();

        var emoji = string.IsNullOrWhiteSpace(req?.Emoji) ? DefaultEmoji : req!.Emoji!.Trim();
        if (emoji.Length > 16) return BadRequest(new { message = "表情代碼過長" });

        var existing = await _db.BoardReactions
            .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == me.Value && r.Emoji == emoji);
        if (existing != null)
            _db.BoardReactions.Remove(existing);            // 取消讚
        else
            _db.BoardReactions.Add(new BoardReaction { PostId = id, UserId = me.Value, Emoji = emoji });
        await _db.SaveChangesAsync();

        var saved = await LoadPostAsync(id);
        return Ok(ToDto(saved!, me, CanManage()));
    }

    // ---------- helpers ----------

    private Task<BoardPost?> LoadPostAsync(int id) => _db.BoardPosts
        .Include(p => p.CreatedByUser)
        .Include(p => p.Comments.Where(c => !c.IsDeleted)).ThenInclude(c => c.CreatedByUser)
        .Include(p => p.Reactions)
        .AsSplitQuery()
        .FirstOrDefaultAsync(p => p.Id == id);

    private int? GetUserId()
    {
        var v = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(v, out var n) ? n : null;
    }

    private bool CanManage() =>
        User.FindAll(JwtClaimTypes.Permission).Any(c => c.Value == Permissions.BoardManage);

    private bool IsOwner(int? authorUserId)
    {
        var me = GetUserId();
        return me != null && authorUserId != null && me.Value == authorUserId.Value;
    }

    private static ObjectResult Forbid403(string message) =>
        new(new { message }) { StatusCode = StatusCodes.Status403Forbidden };

    private static string DisplayName(User? u) =>
        u == null ? "（已停用）" : (u.DisplayName ?? u.UserName);

    private static BoardPostDto ToDto(BoardPost p, int? me, bool canManage)
    {
        var owner = me != null && p.CreatedByUserId == me.Value;
        return new BoardPostDto
        {
            Id = p.Id,
            Content = p.Content,
            IsPinned = p.IsPinned,
            AuthorUserId = p.CreatedByUserId,
            AuthorName = DisplayName(p.CreatedByUser),
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            Edited = p.UpdatedAt != null,
            ReactionCount = p.Reactions.Count,
            ReactedByMe = me != null && p.Reactions.Any(r => r.UserId == me.Value),
            CommentCount = p.Comments.Count(c => !c.IsDeleted),
            Comments = p.Comments
                .Where(c => !c.IsDeleted)
                .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
                .Select(c => ToDto(c, me, canManage))
                .ToList(),
            CanEdit = owner,
            CanDelete = owner || canManage,
        };
    }

    private static BoardCommentDto ToDto(BoardComment c, int? me, bool canManage)
    {
        var owner = me != null && c.CreatedByUserId == me.Value;
        return new BoardCommentDto
        {
            Id = c.Id,
            PostId = c.PostId,
            Content = c.Content,
            AuthorUserId = c.CreatedByUserId,
            AuthorName = DisplayName(c.CreatedByUser),
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            Edited = c.UpdatedAt != null,
            CanEdit = owner,
            CanDelete = owner || canManage,
        };
    }
}
