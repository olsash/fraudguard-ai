using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class FraudCase
{
    public int Id { get; set; }

    public int TransactionId { get; set; }

    public Transaction? Transaction { get; set; }

    public int? PredictionId { get; set; }

    public Prediction? Prediction { get; set; }

    public int? FraudAlertId { get; set; }

    public FraudAlert? FraudAlert { get; set; }

    public int? AssignedAnalystId { get; set; }

    public User? AssignedAnalyst { get; set; }

    [MaxLength(30)]
    public string Status { get; set; } = "Open";

    [MaxLength(20)]
    public string Priority { get; set; } = "Medium";

    public int ModelRiskScore { get; set; }

    [MaxLength(30)]
    public string ModelDecision { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? FinalDecision { get; set; }

    [MaxLength(2000)]
    public string? AnalystComment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? AssignedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime? ReviewStartedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public byte[]? RowVersion { get; set; }

    public ICollection<FraudCaseNote> Notes { get; set; } = [];
}
