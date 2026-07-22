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

    public int BankId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string AccountHolderName { get; set; } = string.Empty;

    public string AccountType { get; set; } = string.Empty;

    public string MaskedAccountNumber { get; set; } = string.Empty;

    public string MaskedIban { get; set; } = string.Empty;

    public string Currency { get; set; } = string.Empty;

    public decimal CurrentBalance { get; set; }

    public bool IsActive { get; set; }

    public DateTime? LinkedAt { get; set; }
}

public class ConnectBankAccountRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Bank is required.")]
    public int BankId { get; set; }

    [Required]
    [MaxLength(150)]
    public string AccountHolderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(34)]
    public string AccountNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(34)]
    public string Iban { get; set; } = string.Empty;

    [Required]
    [MaxLength(6)]
    public string VerificationCode { get; set; } = string.Empty;
}

public class DevelopmentSimulatedBankCredentialsDto
{
    public int BankId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string AccountHolderName { get; set; } = string.Empty;

    public string? AccountNumber { get; set; }

    public string? Iban { get; set; }

    public string? VerificationCode { get; set; }

    public string AccountType { get; set; } = string.Empty;

    public string Currency { get; set; } = string.Empty;

    public decimal CurrentBalance { get; set; }

    public bool IsAlreadyLinked { get; set; }
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

    public string MerchantCode { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Country { get; set; } = string.Empty;

    public string BankName { get; set; } = string.Empty;

    public string RiskLevel { get; set; } = string.Empty;
}

public class AdminMerchantDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string MerchantCode { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string? MerchantCategoryCode { get; set; }

    public string Country { get; set; } = string.Empty;

    public int BankId { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string? MaskedSettlementAccount { get; set; }

    public string? MaskedSettlementIban { get; set; }

    public string RiskLevel { get; set; } = string.Empty;

    public bool IsVerified { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class UpsertMerchantRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(40)]
    public string MerchantCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(10)]
    public string? MerchantCategoryCode { get; set; }

    [Required]
    [MaxLength(100)]
    public string Country { get; set; } = "Kosovo";

    [Range(1, int.MaxValue, ErrorMessage = "Bank is required.")]
    public int BankId { get; set; }

    [Required]
    [MaxLength(30)]
    public string RiskLevel { get; set; } = "Low";

    public bool IsVerified { get; set; } = true;

    public bool IsActive { get; set; } = true;
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
