namespace FraudGuard.Api.DTOs;

public class PredictionResponse
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int? TransactionId { get; set; }

    public string? TransactionMerchant { get; set; }

    public string? TransactionCountry { get; set; }

    public string? TransactionCategory { get; set; }

    public string? TransactionCurrency { get; set; }

    public DateTime? TransactionCreatedAt { get; set; }

    public string? TransactionStatus { get; set; }

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

    public string PredictedClass { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public string[] Reasons { get; set; } = [];

    public string[] ExplanationFactors { get; set; } = [];

    public RiskBreakdownFactor[] RiskBreakdown { get; set; } = [];

    public string? ModelName { get; set; }

    public string? ModelTrainingDate { get; set; }

    public string? ModelVersion { get; set; }

    public string SuggestedAction { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public class RiskBreakdownFactor
{
    public string Factor { get; set; } = string.Empty;

    public string Impact { get; set; } = string.Empty;

    public string Explanation { get; set; } = string.Empty;
}

public class TransactionPredictionResponse
{
    public int TransactionId { get; set; }

    public int PredictionId { get; set; }

    public int RiskScore { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public string? ModelName { get; set; }

    public string? ModelTrainingDate { get; set; }

    public string? ModelVersion { get; set; }

    public string PredictedClass { get; set; } = string.Empty;

    public string[] Explanation { get; set; } = [];

    public DateTime CreatedAt { get; set; }
}
