using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Dtos;

public class ProfileUpdateRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [StringLength(64)]
    public string? DisplayName { get; set; }
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, StringLength(64, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}
