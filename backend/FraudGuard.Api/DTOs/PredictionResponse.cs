namespace FraudGuard.Api.DTOs;

public class PredictionResponse
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public decimal OldBalanceOrigin { get; set; }

    public decimal NewBalanceOrigin { get; set; }

    public decimal OldBalanceDestination { get; set; }

    public decimal NewBalanceDestination { get; set; }

    public double FraudProbability { get; set; }

    public int RiskScore { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool IsFraud { get; set; }

    public double Confidence { get; set; }

    public string[] Reasons { get; set; } = [];

    public string SuggestedAction { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
