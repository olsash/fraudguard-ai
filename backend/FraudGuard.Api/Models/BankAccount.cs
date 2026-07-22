using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class BankAccount
{
    public int Id { get; set; }

    public int? UserId { get; set; }

    public User? User { get; set; }

    public int BankId { get; set; }

    public Bank? Bank { get; set; }

    public int? MerchantId { get; set; }

    [MaxLength(34)]
    public string AccountNumber { get; set; } = string.Empty;

    [MaxLength(34)]
    public string IBAN { get; set; } = string.Empty;

    [MaxLength(50)]
    public string AccountName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string AccountHolderName { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Currency { get; set; } = "EUR";

    public decimal CurrentBalance { get; set; }

    [MaxLength(40)]
    public string AccountType { get; set; } = "Checking";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = [];
}
