using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class TransactionResponseDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string? UserName { get; set; }

    public int? SourceBankAccountId { get; set; }

    public string? SourceAccount { get; set; }

    public int? BeneficiaryId { get; set; }

    public string? BeneficiaryName { get; set; }

    public int? MerchantId { get; set; }

    public string Merchant { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public decimal? OldBalanceOrigin { get; set; }

    public decimal? NewBalanceOrigin { get; set; }

    public decimal? OldBalanceDestination { get; set; }

    public decimal? NewBalanceDestination { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int? RiskScore { get; set; }

    public string Status { get; set; } = string.Empty;

    public string ProcessingStatus { get; set; } = string.Empty;

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
    public int? SourceBankAccountId { get; set; }

    public int? BeneficiaryId { get; set; }

    public int? MerchantId { get; set; }

    [MaxLength(150)]
    public string? Merchant { get; set; }

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; }

    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0.")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "USD";

    [Required]
    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }
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
