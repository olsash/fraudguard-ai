using System.Net.Http.Json;
using System.Net;
using System.Text.Json;
using FraudGuard.Api.DTOs;

namespace FraudGuard.Api.Services;

public class AdminModelService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<AdminModelService> _logger;

    public AdminModelService(HttpClient httpClient, ILogger<AdminModelService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<AdminModelDto>> GetModelsAsync(CancellationToken cancellationToken)
    {
        return await SendAsync<List<AdminModelDto>>(HttpMethod.Get, "/models", cancellationToken);
    }

    public async Task<AdminModelDto> GetModelAsync(string modelId, CancellationToken cancellationToken)
    {
        return await SendAsync<AdminModelDto>(HttpMethod.Get, $"/models/{Uri.EscapeDataString(modelId)}", cancellationToken);
    }

    public async Task<AdminModelDto> RunActionAsync(string modelId, string action, CancellationToken cancellationToken)
    {
        return await SendAsync<AdminModelDto>(
            HttpMethod.Post,
            $"/models/{Uri.EscapeDataString(modelId)}/{Uri.EscapeDataString(action)}",
            cancellationToken);
    }

    private async Task<T> SendAsync<T>(HttpMethod method, string path, CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(method, path);
            if (method == HttpMethod.Post)
            {
                request.Content = JsonContent.Create(new { });
            }

            _logger.LogInformation("Calling ML model service endpoint {Method} {Path}", method, path);
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            _logger.LogInformation("ML model service endpoint {Method} {Path} returned {StatusCode}", method, path, (int)response.StatusCode);
            if (!response.IsSuccessStatusCode)
            {
                var message = await ReadErrorMessageAsync(response, cancellationToken);
                if (response.StatusCode == HttpStatusCode.InternalServerError)
                {
                    message = "ML service failed while processing the model request. Check the Python service logs.";
                }

                throw new AdminModelServiceException(message, (int)response.StatusCode);
            }

            var result = await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken);
            return result ?? throw new AdminModelServiceException("ML service returned an empty model response.", StatusCodes.Status502BadGateway);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach the ML model management service.");
            throw new AdminModelServiceException("ML service is currently unavailable.", StatusCodes.Status503ServiceUnavailable);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Timed out while calling the ML model management service.");
            throw new AdminModelServiceException("ML service did not respond in time.", StatusCodes.Status503ServiceUnavailable);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "ML model management service returned invalid JSON.");
            throw new AdminModelServiceException("ML service returned an invalid response.", StatusCodes.Status502BadGateway);
        }
    }

    private static async Task<string> ReadErrorMessageAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (document.RootElement.TryGetProperty("detail", out var detail))
            {
                if (detail.ValueKind == JsonValueKind.String)
                {
                    return detail.GetString() ?? "ML service request failed.";
                }

                if (detail.ValueKind == JsonValueKind.Object && detail.TryGetProperty("message", out var detailMessage))
                {
                    return detailMessage.GetString() ?? "ML service request failed.";
                }

                return detail.ToString();
            }

            if (document.RootElement.TryGetProperty("message", out var message))
            {
                return message.ValueKind == JsonValueKind.String ? message.GetString() ?? "ML service request failed." : message.ToString();
            }
        }
        catch (JsonException)
        {
            // Keep a user-safe fallback for non-JSON FastAPI/transport errors.
        }

        return $"ML service request failed with status {(int)response.StatusCode}.";
    }
}

public class AdminModelServiceException : Exception
{
    public int StatusCode { get; }

    public AdminModelServiceException(string message, int statusCode)
        : base(message)
    {
        StatusCode = statusCode;
    }
}
