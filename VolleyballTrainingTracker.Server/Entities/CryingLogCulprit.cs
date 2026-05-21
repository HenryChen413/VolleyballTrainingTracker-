namespace VolleyballTrainingTracker.Server.Entities;

/// <summary>
/// 哭哭紀錄的「加分者」：PlayerId 與 ExternalName 二擇一。
/// 球員 → PlayerId，外部人士（對手/教練/家人...）→ ExternalName。
/// </summary>
public class CryingLogCulprit
{
    public int Id { get; set; }
    public int CryingLogId { get; set; }
    public int? PlayerId { get; set; }
    public string? ExternalName { get; set; }

    public CryingLog? CryingLog { get; set; }
    public Player? Player { get; set; }
}
