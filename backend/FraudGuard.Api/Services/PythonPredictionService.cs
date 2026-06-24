using FraudGuard.Api.DTOs;
using System.Text.Json;

namespace FraudGuard.Api.Services;

public class PythonPredictionService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PythonPredictionService> _logger;

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
                _logger.LogWarning(
                    "ML prediction service returned {StatusCode} for transaction type {TransactionType}.",
                    (int)response.StatusCode,
                    request.TransactionType);
                throw new PredictionServiceUnavailableException();
            }

            var result = await response.Content.ReadFromJsonAsync<PythonPredictionResult>(cancellationToken: cancellationToken);
            if (result is null)
            {
                _logger.LogWarning("ML prediction service returned an empty response body.");
                throw new PredictionServiceUnavailableException();
            }

            return result;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not connect to the ML prediction service.");
            throw new PredictionServiceUnavailableException();
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Timed out while waiting for the ML prediction service.");
            throw new PredictionServiceUnavailableException();
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "ML prediction service returned an invalid response payload.");
            throw new PredictionServiceUnavailableException();
        }
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

    public string SuggestedAction { get; set; } = string.Empty;
}

public class PredictionServiceUnavailableException : Exception
{
    public PredictionServiceUnavailableException()
        : base("Prediction service is currently unavailable.")
    {
    }
}
