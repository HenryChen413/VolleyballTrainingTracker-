using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class CryingLogDto
{
    public int Id { get; set; }
    public DateTime OccurredAt { get; set; }

    public int CrierPlayerId { get; set; }
    public string CrierName { get; set; } = string.Empty;
    public int? CrierJerseyNo { get; set; }

    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }

    /// <summary>
    /// 加分者清單（球員 + 外部人士混合）。前端可依 <c>kind</c> 區分顯示。
    /// </summary>
    public List<CryingScorerDto> Scorers { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class CryingScorerDto
{
    /// <summary>"player" 或 "external"。</summary>
    public string Kind { get; set; } = "player";

    /// <summary>球員時為球員 Id；外部時為 null。</summary>
    public int? PlayerId { get; set; }

    /// <summary>顯示名稱：球員時為 Player.Name，外部時為 ExternalName。</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>球員時的背號；外部時為 null。</summary>
    public int? JerseyNo { get; set; }
}

public class CryingLogUpsertRequest
{
    [Required]
    public DateTime OccurredAt { get; set; }

    [Required]
    public int CrierPlayerId { get; set; }

    [Required]
    [StringLength(256, MinimumLength = 1)]
    public string Reason { get; set; } = string.Empty;

    [StringLength(1024)]
    public string? Notes { get; set; }

    /// <summary>球員加分者的 Player Id 清單。後端會去重並過濾掉哭者本人。</summary>
    public List<int> ScorerPlayerIds { get; set; } = new();

    /// <summary>外部加分者的名字（非球員，如「對手」「教練」「家人」）。後端會 trim 並去重。</summary>
    public List<string> ScorerExternalNames { get; set; } = new();
}

public class CryingPlayerRankDto
{
    /// <summary>"player" 或 "external"。</summary>
    public string Kind { get; set; } = "player";

    /// <summary>球員時為球員 Id；外部時為 null。</summary>
    public int? PlayerId { get; set; }

    public string Name { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
    public int Count { get; set; }
}

public class CryingPairRankDto
{
    public int CrierId { get; set; }
    public string CrierName { get; set; } = string.Empty;

    /// <summary>"player" 或 "external"。</summary>
    public string ScorerKind { get; set; } = "player";
    public int? ScorerId { get; set; }
    public string ScorerName { get; set; } = string.Empty;

    public int Count { get; set; }
}

public class CryingStatsDto
{
    public int TotalLogs { get; set; }
    public List<CryingPlayerRankDto> TopCriers { get; set; } = new();
    public List<CryingPlayerRankDto> TopScorers { get; set; } = new();
    public List<CryingPairRankDto> TopPairs { get; set; } = new();
    public List<string> RecentReasons { get; set; } = new();
}

/// <summary>
/// 清單篩選下拉用：來源是「實際出現在哭哭紀錄中的人」，
/// 含已離隊/畢業球員與外部加分者，與現役陣容無關。
/// </summary>
public class CryingFilterOptionsDto
{
    public List<CryingCrierRefDto> Criers { get; set; } = new();
    public List<CryingScorerRefDto> Scorers { get; set; } = new();
}

public class CryingCrierRefDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
}

public class CryingScorerRefDto
{
    /// <summary>"player" 或 "external"。</summary>
    public string Kind { get; set; } = "player";
    public int? PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
}
