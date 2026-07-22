using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class Merchant
{
    public int Id { get; set; }

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(40)]
    public string MerchantCode { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(10)]
    public string? MerchantCategoryCode { get; set; }

    [MaxLength(100)]
    public string Country { get; set; } = string.Empty;

    public int BankId { get; set; }

    public Bank? Bank { get; set; }

    public int? SettlementBankAccountId { get; set; }

    public BankAccount? SettlementBankAccount { get; set; }

    [MaxLength(30)]
    public string RiskLevel { get; set; } = "Low";

    public bool IsVerified { get; set; } = true;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];
}
