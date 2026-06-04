using FraudGuard.Api.DTOs;

namespace FraudGuard.Api.Services;

public class PythonPredictionService
{
    private readonly HttpClient _httpClient;

    public PythonPredictionService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<PythonPredictionResult> PredictAsync(CreatePredictionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/predict", request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new PredictionServiceUnavailableException();
            }

            var result = await response.Content.ReadFromJsonAsync<PythonPredictionResult>(cancellationToken: cancellationToken);
            return result ?? throw new PredictionServiceUnavailableException();
        }
        catch (HttpRequestException)
        {
            throw new PredictionServiceUnavailableException();
        }
        catch (TaskCanceledException)
        {
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

    public double Confidence { get; set; }

    public string[] Reasons { get; set; } = [];

    public string SuggestedAction { get; set; } = string.Empty;
}

public class PredictionServiceUnavailableException : Exception
{
    public PredictionServiceUnavailableException()
        : base("Prediction service is currently unavailable.")
    {
    }
}
