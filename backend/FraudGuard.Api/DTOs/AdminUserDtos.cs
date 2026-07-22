using System.ComponentModel.DataAnnotations;
using FraudGuard.Api.Security;

namespace FraudGuard.Api.DTOs;

public class AdminUserDto
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public int TotalPredictions { get; set; }

    public double AverageRiskScore { get; set; }

    public int HighestRiskScore { get; set; }

    public int FraudPredictionsCount { get; set; }

    public int OpenAssignedCases { get; set; }

    public string Status { get; set; } = "Active";
}

public class AdminUserListResponseDto
{
    public AdminUserDto[] Items { get; set; } = [];

    public AdminUserSummaryDto Summary { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalItems { get; set; }

    public int TotalPages { get; set; }
}

public class AdminUserSummaryDto
{
    public int TotalUsers { get; set; }

    public int ActiveUsers { get; set; }

    public int InactiveUsers { get; set; }

    public int Admins { get; set; }

    public int FraudAnalysts { get; set; }

    public int NormalUsers { get; set; }
}

public class AdminUserDetailsDto : AdminUserDto
{
    public List<RecentPredictionDto> RecentPredictions { get; set; } = [];
}

public class CreateAdminUserDto
{
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    [Required]
    public string Role { get; set; } = ApplicationRoles.User;
}

public class UpdateAdminUserDto
{
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    [Required]
    public string Role { get; set; } = ApplicationRoles.User;

    public string? Status { get; set; }
}
