using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class Transaction
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    public int? SourceBankAccountId { get; set; }

    public BankAccount? SourceBankAccount { get; set; }

    public int? DestinationBankAccountId { get; set; }

    public BankAccount? DestinationBankAccount { get; set; }

    public int? BeneficiaryId { get; set; }

    public Beneficiary? Beneficiary { get; set; }

    public int? MerchantId { get; set; }

    public Merchant? MerchantRecord { get; set; }

    [MaxLength(150)]
    public string Merchant { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Country { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public decimal? OldBalanceOrigin { get; set; }

    public decimal? NewBalanceOrigin { get; set; }

    public decimal? OldBalanceDestination { get; set; }

    public decimal? NewBalanceDestination { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "USD";

    public int? RiskScore { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "pending";

    [MaxLength(30)]
    public string ProcessingStatus { get; set; } = "PendingAnalysis";

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }

    [MaxLength(30)]
    public string TransactionType { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    public DateTime? RejectedAt { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public ICollection<Prediction> Predictions { get; set; } = [];
}
