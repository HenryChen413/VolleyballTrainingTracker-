using System.ComponentModel.DataAnnotations;
using VolleyballTrainingTracker.Server.Validation;

namespace VolleyballTrainingTracker.Server.Dtos;

public class UserListItemDto
{
    public int Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class UserRoleUpdateRequest
{
    [Required]
    public int RoleId { get; set; }
}

public class UserActiveUpdateRequest
{
    public bool IsActive { get; set; }
}

public class UserCreateRequest
{
    [Required, StringLength(64, MinimumLength = 3)]
    public string UserName { get; set; } = string.Empty;

    [Required, StringLength(64, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [StringLength(64)]
    public string? DisplayName { get; set; }

    [OptionalEmailAddress, StringLength(256)]
    public string? Email { get; set; }

    [Required]
    public int RoleId { get; set; }

    public bool IsActive { get; set; } = true;
}

public class UserUpdateRequest
{
    [StringLength(64)]
    public string? DisplayName { get; set; }

    [OptionalEmailAddress, StringLength(256)]
    public string? Email { get; set; }

    /// <summary>留空代表不變更密碼</summary>
    [StringLength(64, MinimumLength = 8)]
    public string? Password { get; set; }

    public int? RoleId { get; set; }
}
