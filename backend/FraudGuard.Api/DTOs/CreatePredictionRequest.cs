using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class CreatePredictionRequest
{
    private static readonly string[] AllowedTypes = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];

    [Required]
    public string TransactionType { get; set; } = string.Empty;

    [Required(ErrorMessage = "Amount is required.")]
    [Range(0, double.MaxValue, ErrorMessage = "Amount must be numeric and non-negative.")]
    public decimal? Amount { get; set; }

    [Required(ErrorMessage = "Old origin balance is required.")]
    [Range(0, double.MaxValue, ErrorMessage = "Old origin balance must be numeric and non-negative.")]
    public decimal? OldBalanceOrigin { get; set; }

    [Required(ErrorMessage = "New origin balance is required.")]
    [Range(0, double.MaxValue, ErrorMessage = "New origin balance must be numeric and non-negative.")]
    public decimal? NewBalanceOrigin { get; set; }

    [Required(ErrorMessage = "Old destination balance is required.")]
    [Range(0, double.MaxValue, ErrorMessage = "Old destination balance must be numeric and non-negative.")]
    public decimal? OldBalanceDestination { get; set; }

    [Required(ErrorMessage = "New destination balance is required.")]
    [Range(0, double.MaxValue, ErrorMessage = "New destination balance must be numeric and non-negative.")]
    public decimal? NewBalanceDestination { get; set; }

    public decimal AmountValue => Amount.GetValueOrDefault();

    public decimal OldBalanceOriginValue => OldBalanceOrigin.GetValueOrDefault();

    public decimal NewBalanceOriginValue => NewBalanceOrigin.GetValueOrDefault();

    public decimal OldBalanceDestinationValue => OldBalanceDestination.GetValueOrDefault();

    public decimal NewBalanceDestinationValue => NewBalanceDestination.GetValueOrDefault();

    public bool HasValidTransactionType()
    {
        return AllowedTypes.Contains(TransactionType, StringComparer.OrdinalIgnoreCase);
    }
}
