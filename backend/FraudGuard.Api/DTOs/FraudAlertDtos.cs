using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class FraudAlertDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string? UserName { get; set; }

    public int TransactionId { get; set; }

    public int? PredictionId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Severity { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int RiskScore { get; set; }

    public string Merchant { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public class UpdateFraudAlertStatusRequest
{
    [Required]
    public string Status { get; set; } = string.Empty;
}
