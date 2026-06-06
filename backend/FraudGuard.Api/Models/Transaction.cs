using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class Transaction
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    [MaxLength(150)]
    public string Merchant { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Country { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "USD";

    public int? RiskScore { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(500)]
    public string? Description { get; set; }

    public ICollection<Prediction> Predictions { get; set; } = [];
}
