using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VolleyballTrainingTracker.Server.Data;
using VolleyballTrainingTracker.Server.Dtos;

namespace VolleyballTrainingTracker.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _db;
    public StatsController(AppDbContext db) => _db = db;

    [HttpGet("overview")]
    public async Task<ActionResult<OverviewDto>> Overview()
    {
        var latestYear = await _db.MatchEvents
            .Where(e => e.AcademicYear != null)
            .MaxAsync(e => (int?)e.AcademicYear);

        int officialEvents = 0, friendlyEvents = 0;
        if (latestYear != null)
        {
            officialEvents = await _db.MatchEvents
                .Where(e => e.AcademicYear == latestYear && e.MatchType == "Official")
                .CountAsync();
            friendlyEvents = await _db.MatchEvents
                .Where(e => e.AcademicYear == latestYear && e.MatchType == "Friendly")
                .CountAsync();
        }

        var dto = new OverviewDto
        {
            ActivePlayerCount = await _db.Players.Where(p => p.IsActive == 1).CountAsync(),
            LastSessionDate = await _db.TrainingSessions
                .OrderByDescending(s => s.SessionDate).Select(s => (DateTime?)s.SessionDate).FirstOrDefaultAsync(),
            LatestAcademicYear = latestYear,
            OfficialEventCount = officialEvents,
            FriendlyEventCount = friendlyEvents,
        };
        return Ok(dto);
    }

    private static readonly string[] MainCategoryKeys = { "Serve", "Pass", "Set", "Attack", "Block", "Dig" };
    private static readonly Dictionary<string, string> CategoryLabel = new()
    {
        ["Serve"] = "發球",
        ["Pass"] = "接發球",
        ["Set"] = "舉球",
        ["Attack"] = "攻擊",
        ["Block"] = "攔網",
        ["Dig"] = "防守",
    };

    [HttpGet("category-distribution")]
    public async Task<ActionResult<CategoryDistributionDto>> CategoryDistribution([FromQuery] int months = 6)
    {
        var since = DateTime.UtcNow.AddMonths(-months + 1).Date;
        var since1st = new DateTime(since.Year, since.Month, 1);

        var drillCounts = await _db.SessionDrills
            .Where(sd => sd.Session!.SessionDate >= since1st)
            .GroupBy(sd => new { sd.Drill!.Category, sd.Drill!.Name })
            .Select(g => new { g.Key.Category, g.Key.Name, Count = g.Count() })
            .ToListAsync();

        var categoryTotals = drillCounts
            .GroupBy(x => x.Category)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));

        var drillsByCategory = drillCounts
            .GroupBy(x => x.Category)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.Count).ThenBy(x => x.Name)
                      .Select(x => new DrillBreakdownDto { Name = x.Name, Count = x.Count })
                      .ToList());

        var mainTotal = MainCategoryKeys.Sum(k => categoryTotals.TryGetValue(k, out var v) ? v : 0);

        var categories = MainCategoryKeys.Select(k =>
        {
            var c = categoryTotals.TryGetValue(k, out var v) ? v : 0;
            return new CategoryItemDto
            {
                Key = k,
                Label = CategoryLabel[k],
                Count = c,
                Percent = mainTotal > 0 ? Math.Round((double)c / mainTotal * 100, 1) : 0,
                Drills = drillsByCategory.TryGetValue(k, out var ds) ? ds : new List<DrillBreakdownDto>(),
            };
        }).ToList();

        return Ok(new CategoryDistributionDto
        {
            Total = mainTotal,
            Categories = categories,
            BasicCount = categoryTotals.TryGetValue("Basic", out var b) ? b : 0,
            FitnessCount = categoryTotals.TryGetValue("Fitness", out var f) ? f : 0,
        });
    }

    [HttpGet("match-summary")]
    public async Task<ActionResult<MatchSummaryDto>> MatchSummary([FromQuery] int? academicYear = null)
    {
        var year = academicYear ?? await _db.MatchEvents
            .Where(e => e.AcademicYear != null)
            .MaxAsync(e => (int?)e.AcademicYear);

        var dto = new MatchSummaryDto { AcademicYear = year };
        if (year == null) return Ok(dto);

        var events = await _db.MatchEvents
            .Where(e => e.AcademicYear == year && e.MatchType == "Official")
            .OrderByDescending(e => e.MatchDate)
            .ThenByDescending(e => e.Id)
            .Include(e => e.Matches)
            .ToListAsync();

        foreach (var ev in events)
            foreach (var m in ev.Matches)
            {
                if (m.Result == "W") dto.Wins++;
                else if (m.Result == "L") dto.Losses++;
                else if (m.Result == "D") dto.Draws++;
            }

        dto.Events = events
            .Select(e => new MatchEventDto
            {
                MatchDate = e.MatchDate,
                MatchName = e.MatchName,
                Ranking = e.Ranking,
                RankingB = e.RankingB,
                Location = e.Location,
                SquadCount = e.SquadCount,
                Lines = e.Matches.OrderBy(x => x.Id).Select(x => new MatchResultLineDto
                {
                    Opponent = x.Opponent,
                    OurSquad = x.OurSquad,
                    OurScore = x.OurScore,
                    OpponentScore = x.OpponentScore,
                    Result = x.Result,
                }).ToList(),
            })
            .ToList();

        dto.EventCount = dto.Events.Count;
        return Ok(dto);
    }

    [HttpGet("recent-events")]
    public async Task<ActionResult<IEnumerable<RecentEventDto>>> RecentEvents([FromQuery] int take = 5)
    {
        var events = await _db.MatchEvents
            .OrderByDescending(e => e.MatchDate)
            .ThenByDescending(e => e.Id)
            .Take(take)
            .Select(e => new RecentEventDto
            {
                MatchDate = e.MatchDate,
                MatchType = e.MatchType,
                MatchName = e.MatchName,
                Ranking = e.Ranking,
                Location = e.Location,
                SquadCount = e.SquadCount,
            })
            .ToListAsync();

        return Ok(events);
    }
}
