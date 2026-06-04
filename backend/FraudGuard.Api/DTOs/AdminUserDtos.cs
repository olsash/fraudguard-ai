using System.ComponentModel.DataAnnotations;

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

    public string Status { get; set; } = "Active";
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
    public string Role { get; set; } = "User";
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
    public string Role { get; set; } = "User";

    public string? Status { get; set; }
}
