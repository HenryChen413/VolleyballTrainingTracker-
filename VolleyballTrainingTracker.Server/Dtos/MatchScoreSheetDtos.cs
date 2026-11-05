using System.Text.Json;

namespace VolleyballTrainingTracker.Server.Dtos;

/// <summary>比賽記錄單可選球員（來自該賽事名單快照）。</summary>
public class SheetRosterPlayerDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? JerseyNo { get; set; }
    public string? Position { get; set; }
}

public class MatchScoreSheetDto
{
    public int SetIndex { get; set; }
    public string? RecorderName { get; set; }
    public JsonElement Content { get; set; }
    public int Version { get; set; }

    /// <summary>UpdatedAt ?? CreatedAt。</summary>
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class MatchScoreSheetsResponse
{
    public int MatchLogId { get; set; }
    public int MatchEventId { get; set; }
    public string Opponent { get; set; } = string.Empty;

    /// <summary>MatchLog.MatchDate ?? MatchEvent.MatchDate。</summary>
    public DateTime MatchDate { get; set; }
    public string? MatchType { get; set; }
    public string? OurSquad { get; set; }
    public List<SheetRosterPlayerDto> Roster { get; set; } = new();

    /// <summary>依 SetIndex 升冪。</summary>
    public List<MatchScoreSheetDto> Sheets { get; set; } = new();
}

public class MatchScoreSheetSaveRequest
{
    public string? RecorderName { get; set; }
    public JsonElement Content { get; set; }

    /// <summary>新建為 0；更新時帶目前版本。</summary>
    public int ExpectedVersion { get; set; }
}
