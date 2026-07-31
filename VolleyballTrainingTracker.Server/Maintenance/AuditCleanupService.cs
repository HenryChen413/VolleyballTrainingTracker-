using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Data;

namespace VolleyballTrainingTracker.Server.Maintenance;

/// <summary>
/// 稽核紀錄清理的背景服務：每 24 小時清除一次 <c>AuditDeletes</c> 中超過保留期限的紀錄。
///
/// 原本這件事掛在 <c>/api/maintenance/keepalive</c> 上、靠外部排程（cron-job.org）觸發，
/// 但 Render 免費方案閒置 15 分鐘就休眠，每天只跑一次的排程等於每次都要走「冷啟喚醒」，
/// 喚醒失敗時 Render 路由層會直接回 503（<c>x-render-routing: hibernate-wake-error</c>），
/// 請求根本進不到應用程式 —— 也就是說資料清理的成功率被綁在平台最不可靠的路徑上。
/// 改成服務自己排程後，只要後端是醒著的就會清理，不再依賴任何外部呼叫。
/// </summary>
public sealed partial class AuditCleanupService : BackgroundService
{
    /// <summary>AuditDeletes 保留期限：超過此年數的紀錄會被清除。</summary>
    public const int RetentionYears = 1;

    /// <summary>啟動後先等一段時間再跑首次清理，避免和冷啟動、健康檢查搶資源。</summary>
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AuditCleanupService> _logger;

    public AuditCleanupService(IServiceScopeFactory scopeFactory, ILogger<AuditCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);

            using var timer = new PeriodicTimer(Interval);
            do
            {
                await RunOnceAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // 服務正常關閉，不是錯誤。
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var deleted = await PurgeExpiredAsync(db, ct);

            if (deleted > 0)
                LogPurged(deleted, RetentionYears);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // 資料庫可能正在休眠或連線暫時中斷；記錄後等下一輪即可，不讓背景作業拖垮整個服務。
            LogPurgeFailed(ex);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "已清除 {Count} 筆超過 {Years} 年的稽核刪除紀錄。")]
    private partial void LogPurged(int count, int years);

    [LoggerMessage(Level = LogLevel.Warning, Message = "稽核紀錄清理失敗，將於下一輪重試。")]
    private partial void LogPurgeFailed(Exception ex);

    /// <summary>
    /// 清除超過保留期限的稽核刪除紀錄，回傳刪除筆數。
    /// <c>ExecuteDeleteAsync</c> 直接下 SQL，繞過 <c>SaveChangesAsync</c>，
    /// 不會把這次刪除本身又寫成一筆 AuditDelete。
    /// </summary>
    public static Task<int> PurgeExpiredAsync(AppDbContext db, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.AddYears(-RetentionYears);
        return db.AuditDeletes
            .Where(a => a.DeletedAt < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}
