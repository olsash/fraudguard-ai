using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class UpdateProfileRequest
{
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(1000)]
    public string? ProfileImageUrl { get; set; }
}
