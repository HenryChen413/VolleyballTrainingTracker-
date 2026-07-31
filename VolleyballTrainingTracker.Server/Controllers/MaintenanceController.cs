using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Maintenance;

namespace VolleyballTrainingTracker.Server.Controllers;

/// <summary>
/// 維護端點：供外部排程服務（cron-job.org）呼叫。
/// 一次呼叫同時達成：
///   1. 對資料庫下一次 DELETE → 算「活動」，解除 Supabase 免費方案的閒置暫停
///   2. 喚醒 Render 免費方案休眠中的後端
///   3. 清除 DeletedAt 超過保留期限的 AuditDeletes 稽核紀錄
/// 匿名存取，靠 X-Maintenance-Key 標頭比對環境變數 Maintenance__Secret 保護。
///
/// 注意：第 3 項已改由 <see cref="AuditCleanupService"/> 背景服務自行排程，
/// 本端點不再是稽核清理的唯一途徑。因為 Render 免費方案休眠後的喚醒會失敗
/// （路由層直接回 503 <c>x-render-routing: hibernate-wake-error</c>，請求進不到這裡），
/// 排程呼叫本端點失敗時，資料清理仍會照常進行。
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class MaintenanceController : ControllerBase
{
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

        // 與背景服務共用同一份清理邏輯，保留期限只定義在一處。
        var deleted = await AuditCleanupService.PurgeExpiredAsync(_db, ct);

        return Ok(new
        {
            status = "ok",
            deletedAuditRows = deleted,
            auditRetentionYears = AuditCleanupService.RetentionYears,
            dbTimeUtc = DateTime.UtcNow,
        });
    }
}
