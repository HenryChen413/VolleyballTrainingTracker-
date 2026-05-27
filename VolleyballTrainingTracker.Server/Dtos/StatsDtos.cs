namespace VolleyballTrainingTracker.Server.Dtos;

public class OverviewDto
{
    public int ActivePlayerCount { get; set; }
    public DateTime? LastSessionDate { get; set; }
    public int? LatestAcademicYear { get; set; }
    public int OfficialEventCount { get; set; }
    public int FriendlyEventCount { get; set; }
}

public class DrillBreakdownDto
{
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class CategoryItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
    public double Percent { get; set; }
    public List<DrillBreakdownDto> Drills { get; set; } = new();
}

public class CategoryDistributionDto
{
    public int Total { get; set; }
    public List<CategoryItemDto> Categories { get; set; } = new();
    public int BasicCount { get; set; }
    public int FitnessCount { get; set; }
}

public class MatchResultLineDto
{
    public string Opponent { get; set; } = string.Empty;
    public string? OurSquad { get; set; }
    public int? OurScore { get; set; }
    public int? OpponentScore { get; set; }
    public string? Result { get; set; }
}

public class MatchEventDto
{
    public DateTime MatchDate { get; set; }
    public string? MatchName { get; set; }
    public string? Ranking { get; set; }
    public string? RankingB { get; set; }
    public string? Location { get; set; }
    public int SquadCount { get; set; }
    public List<MatchResultLineDto> Lines { get; set; } = new();
}

public class MatchSummaryDto
{
    public int? AcademicYear { get; set; }
    public int EventCount { get; set; }
    public int Wins { get; set; }
    public int Losses { get; set; }
    public int Draws { get; set; }
    public List<MatchEventDto> Events { get; set; } = new();
}

public class RecentEventDto
{
    public int Id { get; set; }
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public string? MatchName { get; set; }
    public string? Ranking { get; set; }
    public string? RankingB { get; set; }
    public string? Location { get; set; }
    public int SquadCount { get; set; }
    public List<MatchResultLineDto> Lines { get; set; } = new();
}
