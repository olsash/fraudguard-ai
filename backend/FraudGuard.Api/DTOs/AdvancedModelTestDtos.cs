using System.Text.Json.Serialization;

namespace FraudGuard.Api.DTOs;

public class AdvancedModelTestRequestDto
{
    private static readonly string[] AllowedTypes = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];

    public string? Type { get; set; }

    public string? TransactionType { get; set; }

    public decimal? Amount { get; set; }

    [JsonPropertyName("oldBalanceOrg")]
    public decimal? OldBalanceOrg { get; set; }

    [JsonPropertyName("newBalanceOrig")]
    public decimal? NewBalanceOrig { get; set; }

    [JsonPropertyName("oldBalanceDest")]
    public decimal? OldBalanceDest { get; set; }

    [JsonPropertyName("newBalanceDest")]
    public decimal? NewBalanceDest { get; set; }

    public string TransactionTypeValue => (TransactionType ?? Type ?? string.Empty).Trim().ToUpperInvariant();

    public string[] Validate()
    {
        var errors = new List<string>();

        if (!AllowedTypes.Contains(TransactionTypeValue, StringComparer.OrdinalIgnoreCase))
        {
            errors.Add("Transaction type must be one of CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER.");
        }

        AddRequiredNumberError(errors, Amount, "Amount");
        AddRequiredNumberError(errors, OldBalanceOrg, "Old origin balance");
        AddRequiredNumberError(errors, NewBalanceOrig, "New origin balance");
        AddRequiredNumberError(errors, OldBalanceDest, "Old destination balance");
        AddRequiredNumberError(errors, NewBalanceDest, "New destination balance");

        return errors.ToArray();
    }

    public CreatePredictionRequest ToPredictionRequest()
    {
        return new CreatePredictionRequest
        {
            TransactionType = TransactionTypeValue,
            Amount = Amount,
            OldBalanceOrigin = OldBalanceOrg,
            NewBalanceOrigin = NewBalanceOrig,
            OldBalanceDestination = OldBalanceDest,
            NewBalanceDestination = NewBalanceDest
        };
    }

    private static void AddRequiredNumberError(List<string> errors, decimal? value, string label)
    {
        if (!value.HasValue)
        {
            errors.Add($"{label} is required.");
            return;
        }

        if (value.Value < 0)
        {
            errors.Add($"{label} cannot be negative.");
        }
    }
}

public class AdvancedModelTestResponseDto : PredictionResponse
{
    public string Decision { get; set; } = string.Empty;

    public string[] Explanation { get; set; } = [];

    public DateTime Timestamp { get; set; }
}
