namespace FraudGuard.Api.DTOs;

public class AdminModelDto
{
    public string Id { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public bool IsEnabled { get; set; }

    public bool ArtifactExists { get; set; }

    public double? Accuracy { get; set; }

    public double? Precision { get; set; }

    public double? Recall { get; set; }

    public double? F1Score { get; set; }

    public double? RocAuc { get; set; }

    public string? LastTrainedAt { get; set; }

    public string? LastBenchmarkedAt { get; set; }

    public string ArtifactPath { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public ModelConfusionMatrixDto? ConfusionMatrix { get; set; }
}

public class AdminModelActionResponseDto
{
    public string Message { get; set; } = string.Empty;

    public AdminModelDto Model { get; set; } = new();
}
