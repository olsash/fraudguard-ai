using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class Beneficiary
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    public int BankId { get; set; }

    public Bank? Bank { get; set; }

    public int? DestinationBankAccountId { get; set; }

    public BankAccount? DestinationBankAccount { get; set; }

    [MaxLength(34)]
    public string MaskedAccountReference { get; set; } = string.Empty;

    public bool IsTrusted { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
