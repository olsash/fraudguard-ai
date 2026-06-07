using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class UpdateProfileRequest
{
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }
}
