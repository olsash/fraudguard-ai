using System.ComponentModel.DataAnnotations;

namespace FraudGuard.Api.DTOs;

public class BankDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public string SwiftCode { get; set; } = string.Empty;
}

public class BankAccountDto
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string AccountType { get; set; } = string.Empty;

    public string MaskedAccountNumber { get; set; } = string.Empty;

    public string MaskedIban { get; set; } = string.Empty;

    public string Currency { get; set; } = string.Empty;

    public decimal CurrentBalance { get; set; }

    public bool IsActive { get; set; }
}

public class BeneficiaryDto
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public int BankId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public int? DestinationBankAccountId { get; set; }

    public string MaskedAccountReference { get; set; } = string.Empty;

    public bool IsTrusted { get; set; }
}

public class MerchantDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public string RiskLevel { get; set; } = string.Empty;
}

public class CreateBeneficiaryRequest
{
    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "Bank is required.")]
    public int BankId { get; set; }

    [Required]
    [MaxLength(34)]
    public string AccountReference { get; set; } = string.Empty;

    public bool IsTrusted { get; set; }
}
