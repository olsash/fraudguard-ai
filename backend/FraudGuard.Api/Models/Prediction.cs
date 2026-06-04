using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class Prediction
{
    public int Id { get; set; }

    public int UserId { get; set; }

    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public decimal OldBalanceOrigin { get; set; }

    public decimal NewBalanceOrigin { get; set; }

    public decimal OldBalanceDestination { get; set; }

    public decimal NewBalanceDestination { get; set; }

    public int RiskScore { get; set; }

    [MaxLength(30)]
    public string RiskLevel { get; set; } = string.Empty;

    public bool IsFraud { get; set; }

    public string Explanation { get; set; } = string.Empty;

    public string SuggestedAction { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
