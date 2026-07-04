using FraudGuard.Api.DTOs;

namespace FraudGuard.Api.Services;

public interface IFraudPredictionService
{
    Task<FraudPredictionResult> PredictAsync(CreatePredictionRequest request, CancellationToken cancellationToken);
}

public class FraudPredictionResult
{
    public double FraudProbability { get; set; }

    public int RiskScore { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool IsFraud { get; set; }

    public string PredictedClass { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public string? ModelName { get; set; }

    public string? ModelTrainingDate { get; set; }

    public string? ModelVersion { get; set; }

    public string[] Reasons { get; set; } = [];

    public string[] ExplanationFactors { get; set; } = [];

    public RiskBreakdownFactor[] RiskBreakdown { get; set; } = [];

    public string SuggestedAction { get; set; } = string.Empty;
}

public class FraudPredictionException : Exception
{
    public FraudPredictionException(string message)
        : base(message)
    {
    }
}

public class FraudPredictionInputException : FraudPredictionException
{
    public FraudPredictionInputException(string message)
        : base(message)
    {
    }
}
