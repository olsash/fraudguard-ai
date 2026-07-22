using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.Models;

public class BankAccountVerificationAttempt
{
    public int Id { get; set; }

    public int UserId { get; set; }

    [MaxLength(128)]
    public string AccountLookupHash { get; set; } = string.Empty;

    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
}
