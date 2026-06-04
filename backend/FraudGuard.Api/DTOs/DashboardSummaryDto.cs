namespace FraudGuard.Api.DTOs;

public class DashboardSummaryDto
{
    public int? TotalUsers { get; set; }

    public int TotalPredictions { get; set; }

    public int SafeTransactions { get; set; }

    public int FraudTransactions { get; set; }

    public double AverageRiskScore { get; set; }

    public int HighestRiskScore { get; set; }

    public RecentPredictionDto? LatestPrediction { get; set; }

    public List<RecentPredictionDto> RecentPredictions { get; set; } = [];

    public List<RiskDistributionDto> RiskDistribution { get; set; } = [];

    public List<PredictionChartPointDto> PredictionsPerDay { get; set; } = [];

    public int? HighRiskCases { get; set; }

    public int? CriticalRiskCases { get; set; }
}

public class RiskDistributionDto
{
    public string RiskLevel { get; set; } = string.Empty;

    public int Count { get; set; }
}

public class PredictionChartPointDto
{
    public DateOnly Date { get; set; }

    public int Total { get; set; }

    public int Safe { get; set; }

    public int Fraud { get; set; }
}

public class RecentPredictionDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string? UserEmail { get; set; }

    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public int RiskScore { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool IsFraud { get; set; }

    public string SuggestedAction { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
