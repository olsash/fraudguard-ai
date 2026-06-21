using FraudGuard.Api.DTOs;
using System.Text.Json;

namespace FraudGuard.Api.Services;

public class PythonPredictionService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PythonPredictionService> _logger;
    private const string StartupHint = "ML prediction service is not running. Start the Python FastAPI service on port 8000.";

    public PythonPredictionService(HttpClient httpClient, ILogger<PythonPredictionService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<PythonPredictionResult> PredictAsync(CreatePredictionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/predict", request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "ML prediction service returned {StatusCode} for transaction type {TransactionType}. Body: {ResponseBody}",
                    (int)response.StatusCode,
                    request.TransactionType,
                    responseBody);
                throw new PredictionServiceUnavailableException(BuildUnavailableMessage(responseBody));
            }

            var result = await response.Content.ReadFromJsonAsync<PythonPredictionResult>(cancellationToken: cancellationToken);
            if (result is null)
            {
                _logger.LogWarning("ML prediction service returned an empty response body.");
                throw new PredictionServiceUnavailableException(StartupHint);
            }

            return result;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not connect to the ML prediction service.");
            throw new PredictionServiceUnavailableException(StartupHint);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Timed out while waiting for the ML prediction service.");
            throw new PredictionServiceUnavailableException("ML prediction service did not respond in time. Confirm the Python FastAPI service is running on port 8000.");
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "ML prediction service returned an invalid response payload.");
            throw new PredictionServiceUnavailableException("ML prediction service returned an invalid response. Check the FastAPI service logs.");
        }
    }

    private static string BuildUnavailableMessage(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return StartupHint;
        }

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            if (document.RootElement.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.String)
            {
                return $"ML prediction service error: {detail.GetString()}";
            }
        }
        catch (JsonException)
        {
            return "ML prediction service returned an error. Check the FastAPI service logs.";
        }

        return "ML prediction service returned an error. Check the FastAPI service logs.";
    }
}

public class PythonPredictionResult
{
    public double FraudProbability { get; set; }

    public int RiskScore { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool IsFraud { get; set; }

    public string PredictedClass { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public string? ModelName { get; set; }

    public string? ModelTrainingDate { get; set; }

    public string[] Reasons { get; set; } = [];

    public string[] ExplanationFactors { get; set; } = [];

    public RiskBreakdownFactor[] RiskBreakdown { get; set; } = [];

    public string SuggestedAction { get; set; } = string.Empty;
}

public class PredictionServiceUnavailableException : Exception
{
    public PredictionServiceUnavailableException()
        : this("ML prediction service is not running. Start the Python FastAPI service on port 8000.")
    {
    }

    public PredictionServiceUnavailableException(string message)
        : base(message)
    {
    }
}
