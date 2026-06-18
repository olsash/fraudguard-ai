using System.Text.Json;
using FraudGuard.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/model-comparison")]
public class AdminModelComparisonController : ControllerBase
{
    private const string ResultsRelativePath = "ml/results/model_comparison_results.json";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AdminModelComparisonController> _logger;

    public AdminModelComparisonController(
        IWebHostEnvironment environment,
        ILogger<AdminModelComparisonController> logger)
    {
        _environment = environment;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ModelComparisonResultsDto>> GetModelComparison(CancellationToken cancellationToken)
    {
        var resultsPath = ResolveResultsPath();
        if (resultsPath is null)
        {
            return NotFound(new
            {
                message = "Model comparison results file was not found. Run or export the notebook results to ml/results/model_comparison_results.json."
            });
        }

        try
        {
            await using var stream = System.IO.File.OpenRead(resultsPath);
            var results = await JsonSerializer.DeserializeAsync<ModelComparisonResultsDto>(
                stream,
                JsonOptions,
                cancellationToken);

            if (results is null || results.Models.Count == 0)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Model comparison results file is empty or missing evaluated models."
                });
            }

            return Ok(results);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Model comparison results file is invalid JSON: {ResultsPath}", resultsPath);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = "Model comparison results file is invalid JSON."
            });
        }
        catch (IOException ex)
        {
            _logger.LogError(ex, "Could not read model comparison results file: {ResultsPath}", resultsPath);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = "Model comparison results file could not be read."
            });
        }
    }

    private string? ResolveResultsPath()
    {
        var candidatePaths = new[]
        {
            Path.Combine(_environment.ContentRootPath, "..", "..", ResultsRelativePath),
            Path.Combine(_environment.ContentRootPath, ResultsRelativePath),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "..", ResultsRelativePath),
            Path.Combine(Directory.GetCurrentDirectory(), ResultsRelativePath)
        };

        return candidatePaths
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(System.IO.File.Exists);
    }
}
