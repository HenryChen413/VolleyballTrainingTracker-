using System.Text.Json;

namespace VolleyballTrainingTracker.Server.Dtos;

public class FormationDto
{
    public string Key { get; set; } = string.Empty;
    /// <summary>尚未儲存過為 null（前端改用內建預設）。</summary>
    public JsonElement? Layout { get; set; }
    /// <summary>尚未儲存過為 0。</summary>
    public int Version { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

public class FormationSaveRequest
{
    public JsonElement Layout { get; set; }
    /// <summary>前端載入時的版本；首次新增為 0。</summary>
    public int ExpectedVersion { get; set; }
}
