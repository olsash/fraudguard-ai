using System.Text.Json;

namespace FraudGuard.Api.DTOs;

public class ModelComparisonResultsDto
{
    public string DatasetName { get; set; } = string.Empty;
    public string ProblemType { get; set; } = string.Empty;
    public string TargetVariable { get; set; } = string.Empty;
    public string BestModelName { get; set; } = string.Empty;
    public string BestModelReason { get; set; } = string.Empty;
    public List<ModelComparisonItemDto> Models { get; set; } = [];
}

public class ModelComparisonItemDto
{
    public string ModelName { get; set; } = string.Empty;
    public string ModelType { get; set; } = string.Empty;
    public double Accuracy { get; set; }
    public double Precision { get; set; }
    public double Recall { get; set; }
    public double F1Score { get; set; }
    public double? RocAuc { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ShortDescription { get; set; } = string.Empty;
    public ModelHyperparametersDto? Hyperparameters { get; set; }
}

public class ModelHyperparametersDto
{
    public Dictionary<string, JsonElement> Tested { get; set; } = [];
    public Dictionary<string, JsonElement> Selected { get; set; } = [];
}
