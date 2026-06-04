using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class User
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Role { get; set; } = "User";

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(1000)]
    public string? ProfileImageUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }
}
