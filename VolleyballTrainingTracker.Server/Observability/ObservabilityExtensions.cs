using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Events;

namespace VolleyballTrainingTracker.Server.Observability;

/// <summary>
/// 集中設定可觀測性：結構化日誌（Serilog）與分散式追蹤／指標（OpenTelemetry）。
/// </summary>
public static class ObservabilityExtensions
{
    /// <summary>服務識別名稱，會出現在所有 trace／metric 的 resource 上。</summary>
    public const string ServiceName = "VolleyballTrainingTracker.Server";

    /// <summary>
    /// 在 builder 階段註冊 Serilog 與 OpenTelemetry。
    /// OTLP 匯出器只有在設定了端點時才啟用（環境變數 OTEL_EXPORTER_OTLP_ENDPOINT
    /// 或設定 OpenTelemetry:OtlpEndpoint），沒有 collector 的環境不會產生連線錯誤。
    /// </summary>
    public static void AddObservability(this WebApplicationBuilder builder)
    {
        // ----- Serilog：結構化日誌 -----
        // 預設輸出到 Console；appsettings 的 "Serilog" 區段可再覆寫等級與 sink。
        builder.Host.UseSerilog((context, services, config) => config
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Service", ServiceName)
            .WriteTo.Console()
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services));

        // ----- OpenTelemetry：追蹤與指標 -----
        var otlpEndpoint = builder.Configuration["OpenTelemetry:OtlpEndpoint"]
            ?? Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var hasOtlp = !string.IsNullOrWhiteSpace(otlpEndpoint);

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(
                serviceName: ServiceName,
                serviceVersion: typeof(ObservabilityExtensions).Assembly.GetName().Version?.ToString()))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(o => o.RecordException = true)
                    .AddHttpClientInstrumentation();
                if (hasOtlp) tracing.AddOtlpExporter();
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
                if (hasOtlp) metrics.AddOtlpExporter();
            });
    }
}
