using System.Globalization;
using System.Text;
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
    private const string JsonResultsRelativePath = "ml/results/model_comparison_results.json";
    private const string CsvResultsRelativePath = "ml/results/model_comparison_results.csv";
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
                message = "Model comparison results file was not found. Run the ML training or notebook export to create ml/results/model_comparison_results.json or ml/results/model_comparison_results.csv."
            });
        }

        try
        {
            var results = Path.GetExtension(resultsPath).Equals(".csv", StringComparison.OrdinalIgnoreCase)
                ? await ReadCsvResultsAsync(resultsPath, cancellationToken)
                : await ReadJsonResultsAsync(resultsPath, cancellationToken);

            if (results is null || results.Models.Count == 0)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Model comparison results file is empty or missing evaluated models."
                });
            }

            NormalizeResults(results);
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
        catch (InvalidDataException ex)
        {
            _logger.LogError(ex, "Model comparison results file is invalid: {ResultsPath}", resultsPath);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = ex.Message
            });
        }
    }

    private string? ResolveResultsPath()
    {
        return new[] { _environment.ContentRootPath, Directory.GetCurrentDirectory() }
            .SelectMany(GetCandidatePaths)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(System.IO.File.Exists);
    }

    private static IEnumerable<string> GetCandidatePaths(string startPath)
    {
        var directory = new DirectoryInfo(startPath);

        while (directory is not null)
        {
            yield return Path.Combine(directory.FullName, JsonResultsRelativePath);
            yield return Path.Combine(directory.FullName, CsvResultsRelativePath);
            directory = directory.Parent;
        }
    }

    private static async Task<ModelComparisonResultsDto?> ReadJsonResultsAsync(string resultsPath, CancellationToken cancellationToken)
    {
        await using var stream = System.IO.File.OpenRead(resultsPath);
        return await JsonSerializer.DeserializeAsync<ModelComparisonResultsDto>(
            stream,
            JsonOptions,
            cancellationToken);
    }

    private static async Task<ModelComparisonResultsDto> ReadCsvResultsAsync(string resultsPath, CancellationToken cancellationToken)
    {
        var lines = await System.IO.File.ReadAllLinesAsync(resultsPath, cancellationToken);
        if (lines.Length < 2)
        {
            throw new InvalidDataException("Model comparison CSV is empty or missing model rows.");
        }

        var headers = ParseCsvLine(lines[0])
            .Select(NormalizeHeader)
            .ToArray();

        var models = new List<ModelComparisonItemDto>();
        foreach (var line in lines.Skip(1).Where(line => !string.IsNullOrWhiteSpace(line)))
        {
            var values = ParseCsvLine(line);
            var row = headers
                .Select((header, index) => new { header, value = index < values.Count ? values[index] : string.Empty })
                .Where(item => !string.IsNullOrWhiteSpace(item.header))
                .ToDictionary(item => item.header, item => item.value, StringComparer.OrdinalIgnoreCase);

            models.Add(new ModelComparisonItemDto
            {
                ModelName = ReadString(row, "classifiername", "modelname", "classifier"),
                ModelType = ReadString(row, "modeltype", "type"),
                Accuracy = ReadRequiredDouble(row, "accuracy"),
                Precision = ReadRequiredDouble(row, "precision"),
                Recall = ReadRequiredDouble(row, "recall"),
                F1Score = ReadRequiredDouble(row, "f1score", "f1"),
                RocAuc = ReadOptionalDouble(row, "rocauc", "auc"),
                AveragePrecision = ReadOptionalDouble(row, "averageprecision", "avgprecision"),
                ConfusionMatrix = ReadConfusionMatrix(row),
                Status = ReadString(row, "status"),
                IsBestModel = ReadBoolean(row, "isbestmodel", "bestmodel"),
                Hyperparameters = ReadHyperparameters(row)
            });
        }

        return new ModelComparisonResultsDto
        {
            DatasetName = "ML results export",
            ProblemType = "Binary classification",
            TargetVariable = "isFraud",
            Models = models
        };
    }

    private static void NormalizeResults(ModelComparisonResultsDto results)
    {
        if (string.IsNullOrWhiteSpace(results.BestModelName))
        {
            results.BestModelName = results.Models.FirstOrDefault(model => model.IsBestModel)?.ModelName
                ?? results.Models.FirstOrDefault(model => model.Status.Equals("Best Model", StringComparison.OrdinalIgnoreCase))?.ModelName
                ?? results.Models.OrderByDescending(model => model.F1Score).First().ModelName;
        }

        foreach (var model in results.Models)
        {
            if (string.IsNullOrWhiteSpace(model.ModelName))
            {
                throw new InvalidDataException("Model comparison results contain a model row without a classifier name.");
            }

            model.IsBestModel = model.IsBestModel
                || model.Status.Equals("Best Model", StringComparison.OrdinalIgnoreCase)
                || model.ModelName.Equals(results.BestModelName, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"' && index + 1 < line.Length && line[index + 1] == '"')
            {
                current.Append('"');
                index++;
            }
            else if (character == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (character == ',' && !inQuotes)
            {
                values.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(character);
            }
        }

        values.Add(current.ToString());
        return values;
    }

    private static string NormalizeHeader(string header)
    {
        return new string(header.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
    }

    private static string ReadString(Dictionary<string, string> row, params string[] keys)
    {
        return keys.Select(key => row.GetValueOrDefault(key)).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? string.Empty;
    }

    private static double ReadRequiredDouble(Dictionary<string, string> row, params string[] keys)
    {
        var value = ReadOptionalDouble(row, keys);
        return value ?? throw new InvalidDataException($"Model comparison CSV is missing numeric column '{keys[0]}'.");
    }

    private static double? ReadOptionalDouble(Dictionary<string, string> row, params string[] keys)
    {
        var raw = ReadString(row, keys);
        return double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value : null;
    }

    private static bool ReadBoolean(Dictionary<string, string> row, params string[] keys)
    {
        var raw = ReadString(row, keys).ToLowerInvariant();
        return raw is "true" or "1" or "yes" or "best" or "best model";
    }

    private static ModelConfusionMatrixDto? ReadConfusionMatrix(Dictionary<string, string> row)
    {
        var trueNegatives = ReadOptionalInt(row, "truenegatives", "tn");
        var falsePositives = ReadOptionalInt(row, "falsepositives", "fp");
        var falseNegatives = ReadOptionalInt(row, "falsenegatives", "fn");
        var truePositives = ReadOptionalInt(row, "truepositives", "tp");

        return trueNegatives.HasValue && falsePositives.HasValue && falseNegatives.HasValue && truePositives.HasValue
            ? new ModelConfusionMatrixDto
            {
                TrueNegatives = trueNegatives.Value,
                FalsePositives = falsePositives.Value,
                FalseNegatives = falseNegatives.Value,
                TruePositives = truePositives.Value
            }
            : null;
    }

    private static int? ReadOptionalInt(Dictionary<string, string> row, params string[] keys)
    {
        var raw = ReadString(row, keys);
        return int.TryParse(raw, out var value) ? value : null;
    }

    private static ModelHyperparametersDto? ReadHyperparameters(Dictionary<string, string> row)
    {
        var selected = ReadJsonDictionary(ReadString(row, "selectedhyperparameters", "selectedparams", "bestparams"));
        var tested = ReadJsonDictionary(ReadString(row, "testedhyperparameters", "testedparams"));

        return selected.Count == 0 && tested.Count == 0
            ? null
            : new ModelHyperparametersDto { Selected = selected, Tested = tested };
    }

    private static Dictionary<string, JsonElement> ReadJsonDictionary(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(rawJson, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
