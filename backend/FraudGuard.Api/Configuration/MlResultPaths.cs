namespace FraudGuard.Api.Configuration;

public static class MlResultPaths
{
    public const string ModelComparisonJson = "ml/results/model_comparison_results.json";
    public const string ModelComparisonCsv = "ml/results/model_comparison_results.csv";
    public const string ClusteringResultsJson = "ml/results/clustering_results.json";
    public const string ClusteringResultsCsv = "ml/results/clustering_results.csv";

    public static readonly string[] ModelComparisonResults =
    [
        ModelComparisonJson,
        ModelComparisonCsv
    ];

    public static readonly string[] ClusteringResults =
    [
        ClusteringResultsJson,
        ClusteringResultsCsv
    ];
}
