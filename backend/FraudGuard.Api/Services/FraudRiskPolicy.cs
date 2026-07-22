namespace FraudGuard.Api.Services;

public static class FraudRiskPolicy
{
    public const int ReviewThreshold = 40;
    public const int HighRiskThreshold = 70;
    public const int CriticalRiskThreshold = 90;

    public static string ProcessingStatusForRisk(int riskScore)
    {
        ValidateRiskScore(riskScore);

        if (riskScore >= HighRiskThreshold)
        {
            return "BlockedPendingReview";
        }

        return riskScore >= ReviewThreshold ? "PendingReview" : "Completed";
    }

    public static string TransactionStatusForProcessingStatus(string processingStatus)
    {
        return processingStatus switch
        {
            "Completed" => "safe",
            "Rejected" => "fraud",
            "Failed" => "pending",
            _ => "review"
        };
    }

    public static string PriorityForRisk(int riskScore)
    {
        ValidateRiskScore(riskScore);

        return riskScore >= CriticalRiskThreshold ? "Critical"
            : riskScore >= HighRiskThreshold ? "High"
            : riskScore >= ReviewThreshold ? "Medium"
            : "Low";
    }

    public static string AlertSeverityForRisk(int riskScore)
    {
        ValidateRiskScore(riskScore);

        return riskScore >= CriticalRiskThreshold ? "critical"
            : riskScore >= HighRiskThreshold ? "high"
            : riskScore >= ReviewThreshold ? "medium"
            : "low";
    }

    public static string ModelDecisionForRisk(int riskScore, bool isFraud)
    {
        ValidateRiskScore(riskScore);

        if (isFraud || riskScore >= HighRiskThreshold)
        {
            return "Fraud";
        }

        return riskScore >= ReviewThreshold ? "Review" : "Safe";
    }

    public static void ValidateRiskScore(int riskScore)
    {
        if (riskScore is < 0 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(riskScore), riskScore, "Risk score must be between 0 and 100.");
        }
    }
}
