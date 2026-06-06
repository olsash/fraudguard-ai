using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class TransactionResponseDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string? UserName { get; set; }

    public string Merchant { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int? RiskScore { get; set; }

    public string Status { get; set; } = string.Empty;

    public string TransactionType { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public string? Description { get; set; }

    public int? LatestPredictionId { get; set; }

    public string[] LatestPredictionExplanation { get; set; } = [];

    public DateTime? LatestPredictionAt { get; set; }

    public double? LatestPredictionConfidence { get; set; }
}

public class CreateTransactionRequestDto
{
    [Required]
    [MaxLength(150)]
    public string Merchant { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Country { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0.")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "USD";

    [Required]
    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }
}

public class UpdateTransactionStatusRequestDto
{
    [Required]
    public string Status { get; set; } = string.Empty;
}

public class TransactionSummaryDto
{
    public int TotalTransactions { get; set; }

    public int PendingCount { get; set; }

    public int SafeCount { get; set; }

    public int ReviewCount { get; set; }

    public int FraudCount { get; set; }

    public decimal TotalAmount { get; set; }

    public double AverageRisk { get; set; }
}
