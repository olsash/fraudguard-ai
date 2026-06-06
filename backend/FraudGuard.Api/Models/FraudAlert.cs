using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class FraudAlert
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    public int TransactionId { get; set; }

    public Transaction? Transaction { get; set; }

    public int? PredictionId { get; set; }

    public Prediction? Prediction { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = "High Risk Transaction Detected";

    [MaxLength(20)]
    public string Severity { get; set; } = "high";

    [MaxLength(20)]
    public string Status { get; set; } = "open";

    public int RiskScore { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
