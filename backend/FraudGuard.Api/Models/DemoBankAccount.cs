using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class DemoBankAccount
{
    public int Id { get; set; }

    public int BankId { get; set; }

    public Bank? Bank { get; set; }

    [MaxLength(150)]
    public string AccountHolderName { get; set; } = string.Empty;

    [MaxLength(34)]
    public string AccountNumber { get; set; } = string.Empty;

    [MaxLength(34)]
    public string Iban { get; set; } = string.Empty;

    [MaxLength(40)]
    public string AccountType { get; set; } = "Current";

    [MaxLength(10)]
    public string Currency { get; set; } = "EUR";

    public decimal CurrentBalance { get; set; }

    [MaxLength(128)]
    public string VerificationCodeHash { get; set; } = string.Empty;

    public bool IsLinked { get; set; }

    public int? DevelopmentUserId { get; set; }

    public User? DevelopmentUser { get; set; }

    public int? LinkedUserId { get; set; }

    public User? LinkedUser { get; set; }

    public DateTime? LinkedAt { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];
}
