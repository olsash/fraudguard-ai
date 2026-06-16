using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class SystemLog
{
    public int Id { get; set; }

    [MaxLength(20)]
    public string Level { get; set; } = "Info";

    [MaxLength(30)]
    public string Source { get; set; } = "api";

    [MaxLength(500)]
    public string Message { get; set; } = string.Empty;

    public int? UserId { get; set; }

    [MaxLength(150)]
    public string? UserName { get; set; }

    [MaxLength(20)]
    public string? Method { get; set; }

    [MaxLength(300)]
    public string? Path { get; set; }

    [MaxLength(80)]
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
