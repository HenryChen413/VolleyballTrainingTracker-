using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Entities;

namespace VolleyballTrainingTracker.Server.Data;

public class AppDbContext : DbContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AppDbContext(DbContextOptions<AppDbContext> options, IHttpContextAccessor httpContextAccessor)
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Drill> Drills => Set<Drill>();
    public DbSet<TrainingSession> TrainingSessions => Set<TrainingSession>();
    public DbSet<SessionDrill> SessionDrills => Set<SessionDrill>();
    public DbSet<MatchEvent> MatchEvents => Set<MatchEvent>();
    public DbSet<MatchEventPlayer> MatchEventPlayers => Set<MatchEventPlayer>();
    public DbSet<MatchLog> MatchLogs => Set<MatchLog>();
    public DbSet<AuditDelete> AuditDeletes => Set<AuditDelete>();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        var now = DateTime.UtcNow;

        // Snapshot deleted entries before processing (original values are still available)
        var deletedSnapshots = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Deleted && e.Entity is not AuditDelete)
            .Select(e => new
            {
                TableName = e.Metadata.GetTableName() ?? e.Metadata.Name ?? "Unknown",
                RowId = TryGetIntId(e),
                RowJson = SerializeOriginalValues(e),
            })
            .ToList();

        foreach (var entry in ChangeTracker.Entries().Where(e => e.Entity is not AuditDelete))
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Metadata.FindProperty("CreatedAt") is not null)
                    entry.CurrentValues["CreatedAt"] = now;
                if (entry.Metadata.FindProperty("CreatedByUserId") is not null)
                    entry.CurrentValues["CreatedByUserId"] = (object?)userId;
            }
            else if (entry.State == EntityState.Modified)
            {
                if (entry.Metadata.FindProperty("UpdatedAt") is not null)
                    entry.CurrentValues["UpdatedAt"] = now;
                if (entry.Metadata.FindProperty("UpdatedByUserId") is not null)
                    entry.CurrentValues["UpdatedByUserId"] = (object?)userId;
            }
        }

        foreach (var snap in deletedSnapshots)
        {
            AuditDeletes.Add(new AuditDelete
            {
                TableName = snap.TableName,
                RowId = snap.RowId,
                DeletedByUserId = userId,
                DeletedAt = now,
                RowJson = snap.RowJson,
            });
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Role>(e =>
        {
            e.ToTable("Roles");
            e.Property(x => x.Name).HasMaxLength(32).IsRequired();
            e.Property(x => x.Description).HasMaxLength(256);
            e.Property(x => x.AllowedPages).IsRequired();
            e.Property(x => x.Permissions).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<User>(e =>
        {
            e.ToTable("Users");
            e.Property(x => x.UserName).HasMaxLength(64).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(256).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(64);
            e.HasIndex(x => x.UserName).IsUnique();
            e.HasOne(x => x.Role).WithMany(r => r.Users).HasForeignKey(x => x.RoleId);
        });

        b.Entity<Player>(e =>
        {
            e.ToTable("Players");
            e.Property(x => x.Name).HasMaxLength(64).IsRequired();
            e.Property(x => x.Nickname).HasMaxLength(32);
            e.Property(x => x.Position).HasMaxLength(16);
            e.Property(x => x.DominantHand).HasMaxLength(8);
            e.Property(x => x.Notes).HasMaxLength(512);
            e.Property(x => x.JoinedAt).HasColumnType("date");
            e.Property(x => x.BirthDate).HasColumnType("date");
            e.HasOne(x => x.User).WithMany(u => u.Players).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<Drill>(e =>
        {
            e.ToTable("Drills");
            e.Property(x => x.Name).HasMaxLength(64).IsRequired();
            e.Property(x => x.Category).HasMaxLength(32).IsRequired();
            e.Property(x => x.Description).HasMaxLength(512);
            e.HasIndex(x => x.Name).IsUnique();
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<TrainingSession>(e =>
        {
            e.ToTable("TrainingSessions");
            e.Property(x => x.SessionDate).HasColumnType("date");
            e.Property(x => x.StartTime).HasColumnType("time(0)");
            e.Property(x => x.Location).HasMaxLength(128);
            e.Property(x => x.Theme).HasMaxLength(128);
            e.Property(x => x.Notes).HasMaxLength(1024);
            e.HasOne(x => x.Coach).WithMany(u => u.CoachedSessions).HasForeignKey(x => x.CoachUserId);
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<SessionDrill>(e =>
        {
            e.ToTable("SessionDrills");
            e.HasKey(x => new { x.SessionId, x.DrillId });
            e.HasOne(x => x.Session).WithMany(s => s.SessionDrills).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Drill).WithMany(d => d.SessionDrills).HasForeignKey(x => x.DrillId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<MatchEvent>(e =>
        {
            e.ToTable("MatchEvents");
            e.Property(x => x.MatchType).HasMaxLength(16);
            e.Property(x => x.MatchName).HasMaxLength(128);
            e.Property(x => x.Location).HasMaxLength(128);
            e.Property(x => x.Ranking).HasMaxLength(64);
            e.Property(x => x.RankingB).HasMaxLength(64);
            e.Property(x => x.VideoUrl).HasMaxLength(512);
            e.Property(x => x.Notes).HasMaxLength(1024);
            e.Property(x => x.MatchDate).HasColumnType("date");
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<MatchEventPlayer>(e =>
        {
            e.ToTable("MatchEventPlayers");
            e.HasKey(x => new { x.MatchEventId, x.PlayerId });
            e.Property(x => x.PlayerName).HasMaxLength(64).IsRequired();
            e.Property(x => x.Position).HasMaxLength(64);
            e.Property(x => x.OurSquad).HasMaxLength(16);
            e.HasOne(x => x.MatchEvent).WithMany(m => m.Players).HasForeignKey(x => x.MatchEventId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Player).WithMany().HasForeignKey(x => x.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<MatchLog>(e =>
        {
            e.ToTable("MatchLogs");
            e.Property(x => x.Opponent).HasMaxLength(128).IsRequired();
            e.Property(x => x.OurSquad).HasMaxLength(16);
            e.Property(x => x.Result).HasMaxLength(8);
            e.HasOne(x => x.MatchEvent).WithMany(m => m.Matches).HasForeignKey(x => x.MatchEventId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.UpdatedByUser).WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.NoAction);
        });

        b.Entity<AuditDelete>(e =>
        {
            e.ToTable("AuditDeletes");
            e.Property(x => x.TableName).HasMaxLength(64).IsRequired();
            e.HasOne(x => x.DeletedBy).WithMany().HasForeignKey(x => x.DeletedByUserId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    private int? GetCurrentUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var sid = user?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                  ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(sid, out var id) ? id : null;
    }

    private static int TryGetIntId(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        var prop = entry.Metadata.FindProperty("Id");
        if (prop == null) return 0;
        var val = entry.OriginalValues[prop];
        return val is int n ? n : 0;
    }

    private static string? SerializeOriginalValues(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry)
    {
        try
        {
            var dict = entry.OriginalValues.Properties
                .ToDictionary(p => p.Name, p => entry.OriginalValues[p]);
            return JsonSerializer.Serialize(dict);
        }
        catch
        {
            return null;
        }
    }
}
