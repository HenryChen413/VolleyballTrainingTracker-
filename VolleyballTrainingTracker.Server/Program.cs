using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using VolleyballTrainingTracker.Server.Auth;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Entities;
using VolleyballTrainingTracker.Server.Maintenance;
using VolleyballTrainingTracker.Server.Observability;
using VolleyballTrainingTracker.Server.Tools;

var builder = WebApplication.CreateBuilder(args);

// ----- 可觀測性（Serilog 結構化日誌 + OpenTelemetry 追蹤／指標）-----
builder.AddObservability();

// ----- DB -----
builder.Services.AddHttpContextAccessor();
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ----- JWT -----
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));
builder.Services.AddSingleton<JwtTokenService>();

var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>()!;

// 啟動時驗證 JWT 金鑰：非開發環境若金鑰為空、過短或仍是公開預設值，直接拒絕啟動。
// CLI 模式（export-schema / seed-*）不啟動 Web 伺服器，不需要 JWT 金鑰，故略過。
const string DefaultInsecureSecret = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_AT_LEAST_32_CHARS_LONG_PLEASE";
if (args.Length == 0 && !builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwt.SecretKey)
        || jwt.SecretKey.Length < 32
        || jwt.SecretKey == DefaultInsecureSecret
        || jwt.SecretKey.StartsWith("dev-only", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "Jwt:SecretKey 未設定或不安全。生產環境必須以環境變數 Jwt__SecretKey 注入一組至少 32 字元的隨機字串。");
    }
    if (string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("Default")))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:Default 未設定。生產環境必須以環境變數 ConnectionStrings__Default 注入。");
    }
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        o.SaveToken = true;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        // 每個請求驗章後再查 DB：使用者若已被停用或刪除，立即讓 token 失效，
        // 不必等 token 自然過期（解決停用後舊 token 仍可用的問題）。
        o.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var sub = ctx.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                          ?? ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(sub, out var uid))
                {
                    ctx.Fail("Invalid token subject.");
                    return;
                }
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var active = await db.Users
                    .Where(u => u.Id == uid)
                    .Select(u => (bool?)u.IsActive)
                    .FirstOrDefaultAsync();
                if (active != true)
                    ctx.Fail("User is inactive or no longer exists.");
            }
        };
    });

builder.Services.AddAuthorization();

// ----- Rate limiting -----
// 對登入端點做 IP 層級限流，阻擋密碼暴力破解。
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// ----- CORS -----
// JWT 走 Authorization 標頭（非 cookie），不需要 AllowCredentials。
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

// ----- 反向代理 -----
// 容器在反向代理（Nginx/Caddy）後方時，採信 X-Forwarded-* 以正確判斷 HTTPS / 來源 IP。
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});

// ----- 背景維護作業 -----
// 定期清除過期稽核紀錄，不依賴外部排程呼叫 /api/maintenance/keepalive
// （Render 免費方案休眠喚醒失敗時，該請求根本進不到應用程式）。
// CLI 模式不呼叫 app.Run()，背景服務不會啟動。
builder.Services.AddHostedService<AuditCleanupService>();

// ----- MVC + Swagger -----
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "VolleyballTrainingTracker API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "在此貼上 JWT token (不需 Bearer 前綴)"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ----- CLI mode -----
if (args.Length > 0)
{
    var cmd = args[0].ToLowerInvariant();
    using var scope = app.Services.CreateScope();
    var sp = scope.ServiceProvider;

    if (cmd == "export-schema")
    {
        var exporter = new SchemaExporter(
            sp.GetRequiredService<AppDbContext>(),
            app.Configuration["SchemaExporter:OutputDir"] ?? "../volleyballtrainingtracker.client/Schema");
        await exporter.RunAsync();
        return;
    }

    if (cmd == "seed-roles")
    {
        await SeedRolesAsync(sp.GetRequiredService<AppDbContext>());
        return;
    }

    if (cmd == "seed-user")
    {
        // Usage: dotnet run -- seed-user <UserName> <Password> [RoleName=Coach] [Email] [DisplayName]
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Usage: seed-user <UserName> <Password> [RoleName=Admin|Coach|Player|...] [Email] [DisplayName]");
            return;
        }
        var db = sp.GetRequiredService<AppDbContext>();
        await SeedRolesAsync(db);

        var userName = args[1];
        var password = args[2];
        var roleName = args.Length > 3 ? args[3] : "Coach";
        var email = args.Length > 4 ? args[4] : $"{userName.ToLowerInvariant()}@example.com";
        var display = args.Length > 5 ? args[5] : userName;

        var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
        if (role == null)
        {
            Console.Error.WriteLine($"[seed-user] Role '{roleName}' not found. Available: {string.Join(", ", db.Roles.Select(r => r.Name).ToList())}");
            return;
        }

        var existing = db.Users.FirstOrDefault(u => u.UserName == userName);
        if (existing != null)
        {
            existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            existing.RoleId = role.Id;
            existing.Email = email;
            existing.DisplayName = display;
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
            Console.WriteLine($"[seed-user] Updated existing user '{userName}' (Role={roleName})");
        }
        else
        {
            db.Users.Add(new User
            {
                UserName = userName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                RoleId = role.Id,
                DisplayName = display,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
            Console.WriteLine($"[seed-user] Created user '{userName}' (Role={roleName})");
        }
        await db.SaveChangesAsync();
        return;
    }

    Console.Error.WriteLine($"Unknown command: {cmd}. Available: export-schema, seed-roles, seed-user");
    return;
}

app.UseForwardedHeaders();

// HTTP 請求結構化日誌：每個請求一行，含方法、路徑、狀態碼與耗時。
app.UseSerilogRequestLogging();

// 安全性 HTTP 標頭：防點擊劫持、MIME 嗅探、控制 referrer。
var isDev = app.Environment.IsDevelopment();
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "no-referrer";
    h["X-XSS-Protection"] = "0";
    // 此服務只回傳 JSON API，不需載入任何外部資源；用最嚴格的 CSP。
    // 開發環境略過，避免擋掉 Swagger UI（會載入內嵌 script/style）。
    if (!isDev)
        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
// 健康檢查端點：供 Render 等部署平台探活，不需驗證、不碰資料庫。
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Run();


// ---------- local helpers ----------

static async Task SeedRolesAsync(AppDbContext db)
{
    var allPerms = JsonSerializer.Serialize(Permissions.All);
    var allPages = JsonSerializer.Serialize(Pages.All);

    var coachPerms = JsonSerializer.Serialize(new[]
    {
        Permissions.PlayersEdit,
        Permissions.SessionsEdit,
        Permissions.DrillsEdit,
        Permissions.SponsorsEdit,
    });
    var coachPages = JsonSerializer.Serialize(new[]
    {
        Pages.Dashboard, Pages.Calendar, Pages.Players, Pages.Sessions, Pages.Tactics, Pages.Drills, Pages.Board, Pages.Sponsors, Pages.Profile,
    });
    var playerPerms = JsonSerializer.Serialize(Array.Empty<string>());
    var playerPages = coachPages; // 跟 Coach 同步主功能可看
    var captainPerms = playerPerms;
    var captainPages = playerPages;

    await UpsertRoleAsync(db, "Admin",       "系統管理員（不可刪）", allPerms,     allPages,     isSystem: true);
    await UpsertRoleAsync(db, "Coach",       "教練（不可刪）",        coachPerms,   coachPages,   isSystem: true);
    await UpsertRoleAsync(db, "Player",      "選手（不可刪）",        playerPerms,  playerPages,  isSystem: true);
    await UpsertRoleAsync(db, "Captain",     "隊長（不可刪）",        captainPerms, captainPages, isSystem: true);
    await UpsertRoleAsync(db, "ViceCaptain", "副隊長（不可刪）",      captainPerms, captainPages, isSystem: true);

    // Admin 角色定義為「萬能」：每次 seed 都同步補齊最新的 Permissions.All / Pages.All，
    // 避免新增頁面或權限後既有的 Admin 還停留在舊清單。其他系統角色維持「不覆蓋」。
    var admin = await db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin");
    if (admin != null)
    {
        admin.Permissions = allPerms;
        admin.AllowedPages = allPages;
    }
    await db.SaveChangesAsync();
    Console.WriteLine("[seed-roles] System roles ready: Admin, Coach, Player, Captain, ViceCaptain");
}

static async Task UpsertRoleAsync(AppDbContext db, string name, string desc, string perms, string pages, bool isSystem)
{
    var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == name);
    if (role == null)
    {
        db.Roles.Add(new Role
        {
            Name = name,
            Description = desc,
            Permissions = perms,
            AllowedPages = pages,
            IsSystem = isSystem,
            CreatedAt = DateTime.UtcNow,
        });
    }
    // 已存在則不覆蓋（避免重複執行時擦掉管理員的自訂）
}
