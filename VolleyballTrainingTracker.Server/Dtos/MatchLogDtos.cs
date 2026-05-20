using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

// ============== MatchEvent (父：一場賽事) ==============

public class MatchEventListItemDto
{
    public int Id { get; set; }
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public int? AcademicYear { get; set; }
    public string? MatchName { get; set; }
    public string? Location { get; set; }
    public string? Ranking { get; set; }
    public string? RankingB { get; set; }
    public string? VideoUrl { get; set; }
    public string? Notes { get; set; }
    public int SquadCount { get; set; }
    public int PlayerCount { get; set; }
    public List<MatchEventPlayerDto> Players { get; set; } = new();
    public List<MatchLogItemDto> Matches { get; set; } = new();
}

public class MatchEventDetailDto
{
    public int Id { get; set; }
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public int? AcademicYear { get; set; }
    public string? MatchName { get; set; }
    public string? Location { get; set; }
    public string? Ranking { get; set; }
    public string? RankingB { get; set; }
    public string? VideoUrl { get; set; }
    public string? Notes { get; set; }
    public int SquadCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
    public List<MatchEventPlayerDto> Players { get; set; } = new();
    public List<MatchLogItemDto> Matches { get; set; } = new();
}

public class MatchEventPlayerDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
    public string? Position { get; set; }
    public string? OurSquad { get; set; }
}

public class MatchLogItemDto
{
    public int Id { get; set; }
    public string Opponent { get; set; } = string.Empty;
    public string? OurSquad { get; set; }
    public int? Set1Our { get; set; }
    public int? Set1Opp { get; set; }
    public int? Set2Our { get; set; }
    public int? Set2Opp { get; set; }
    public int? Set3Our { get; set; }
    public int? Set3Opp { get; set; }
    public int? OurScore { get; set; }
    public int? OpponentScore { get; set; }
    public string? Result { get; set; }

    /// <summary>該筆對戰的實際日期（僅 MatchType=Official 時可填，跨日賽事用）。</summary>
    public DateTime? MatchDate { get; set; }

    /// <summary>友誼賽動態局分；Official 模式為空陣列。</summary>
    public List<MatchLogSetDto> Sets { get; set; } = new();
}

public class MatchLogSetDto
{
    public int Id { get; set; }
    public short SetIndex { get; set; }
    public int OurScore { get; set; }
    public int OpponentScore { get; set; }
}

public class MatchEventUpsertRequest
{
    [Required]
    public DateTime MatchDate { get; set; }

    [StringLength(16)]
    public string? MatchType { get; set; }

    [Range(1, 999)]
    public int? AcademicYear { get; set; }

    [StringLength(128)]
    public string? MatchName { get; set; }

    [StringLength(128)]
    public string? Location { get; set; }

    [StringLength(64)]
    public string? Ranking { get; set; }

    [StringLength(64)]
    public string? RankingB { get; set; }

    [StringLength(512)]
    public string? VideoUrl { get; set; }

    [StringLength(1024)]
    public string? Notes { get; set; }

    [Range(1, 9)]
    public int SquadCount { get; set; } = 1;

    public List<MatchEventPlayerInput> Players { get; set; } = new();

    [Required]
    public List<MatchLogUpsertRequest> Matches { get; set; } = new();
}

public class MatchEventPlayerInput
{
    [Required]
    public int PlayerId { get; set; }

    [StringLength(16)]
    public string? OurSquad { get; set; }
}

public class MatchLogUpsertRequest
{
    /// <summary>編輯時保留既有 Id；新增為 null。</summary>
    public int? Id { get; set; }

    [Required]
    [StringLength(128)]
    public string Opponent { get; set; } = string.Empty;

    [StringLength(16)]
    public string? OurSquad { get; set; }

    [Range(0, 99)]
    public int? Set1Our { get; set; }
    [Range(0, 99)]
    public int? Set1Opp { get; set; }
    [Range(0, 99)]
    public int? Set2Our { get; set; }
    [Range(0, 99)]
    public int? Set2Opp { get; set; }
    [Range(0, 99)]
    public int? Set3Our { get; set; }
    [Range(0, 99)]
    public int? Set3Opp { get; set; }

    /// <summary>
    /// 比賽：局數比（BO3 → 0~2）；友誼賽：局勝數，由前端從 Sets 算出，上限放寬到 99。
    /// </summary>
    [Range(0, 99)]
    public int? OurScore { get; set; }
    [Range(0, 99)]
    public int? OpponentScore { get; set; }

    [StringLength(8)]
    public string? Result { get; set; }

    /// <summary>該筆對戰的實際日期；後端在 MatchType ≠ Official 時會強制清為 null。</summary>
    public DateTime? MatchDate { get; set; }

    /// <summary>友誼賽局分明細；Official 模式後端會強制清空此欄位。</summary>
    public List<MatchLogSetUpsertRequest> Sets { get; set; } = new();
}

public class MatchLogSetUpsertRequest
{
    [Range(1, 99)]
    public short SetIndex { get; set; }

    [Range(0, 99)]
    public int OurScore { get; set; }

    [Range(0, 99)]
    public int OpponentScore { get; set; }
}
