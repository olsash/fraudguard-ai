using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class CreatePredictionRequest
{
    private static readonly string[] AllowedTypes = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];

    [Required]
    public string TransactionType { get; set; } = string.Empty;

    [Range(0, double.MaxValue, ErrorMessage = "Amount cannot be negative.")]
    public decimal Amount { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Old balance origin cannot be negative.")]
    public decimal OldBalanceOrigin { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "New balance origin cannot be negative.")]
    public decimal NewBalanceOrigin { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Old balance destination cannot be negative.")]
    public decimal OldBalanceDestination { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "New balance destination cannot be negative.")]
    public decimal NewBalanceDestination { get; set; }

    public bool HasValidTransactionType()
    {
        return AllowedTypes.Contains(TransactionType, StringComparer.OrdinalIgnoreCase);
    }
}
