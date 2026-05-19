using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Data;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 維護端點：供外部排程服務（cron-job.org）每日呼叫一次。
/// 一次呼叫同時達成：
///   1. 對資料庫下一次 DELETE → 算「活動」，解除 Supabase 免費方案的閒置暫停
///   2. 喚醒 Render 免費方案休眠中的後端
///   3. 清除 DeletedAt 超過 1 年的 AuditDeletes 稽核紀錄
/// 匿名存取，靠 X-Maintenance-Key 標頭比對環境變數 Maintenance__Secret 保護。
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class MaintenanceController : ControllerBase
{
    /// <summary>AuditDeletes 保留期限：超過此年數的紀錄會被清除。</summary>
    private const int AuditRetentionYears = 1;

    private const string KeyHeader = "X-Maintenance-Key";

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public MaintenanceController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpGet("keepalive")]
    public async Task<IActionResult> KeepAlive(CancellationToken ct)
    {
        var expected = _config["Maintenance:Secret"];

        // 未設定密鑰：拒絕服務，避免端點在沒有保護的情況下裸奔。
        if (string.IsNullOrWhiteSpace(expected))
            return StatusCode(StatusCodes.Status503ServiceUnavailable);

        // 密鑰缺漏或不符：回 404 隱蔽端點存在，不洩漏「猜對路徑了」的資訊。
        var provided = Request.Headers[KeyHeader].ToString();
        if (string.IsNullOrEmpty(provided) || provided != expected)
            return NotFound();

        // 清除一年以上的稽核紀錄。ExecuteDeleteAsync 直接下 SQL，
        // 繞過 SaveChangesAsync，不會把這次刪除本身又寫成一筆 AuditDelete。
        var cutoff = DateTime.UtcNow.AddYears(-AuditRetentionYears);
        var deleted = await _db.AuditDeletes
            .Where(a => a.DeletedAt < cutoff)
            .ExecuteDeleteAsync(ct);

        return Ok(new
        {
            status = "ok",
            deletedAuditRows = deleted,
            auditRetentionYears = AuditRetentionYears,
            dbTimeUtc = DateTime.UtcNow,
        });
    }
}
