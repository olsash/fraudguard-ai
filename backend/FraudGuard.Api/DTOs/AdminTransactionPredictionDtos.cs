namespace FraudGuard.Api.DTOs;

public class AdminTransactionDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string Merchant { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public int? RiskScore { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int? PredictionId { get; set; }
}

public class AdminTransactionDetailDto : AdminTransactionDto
{
    public string? Description { get; set; }
    public AdminPredictionSummaryDto? Prediction { get; set; }
    public AdminAlertSummaryDto? Alert { get; set; }
}

public class AdminPredictionDto
{
    public int Id { get; set; }
    public int? TransactionId { get; set; }
    public string TransactionMerchant { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string Country { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public int RiskScore { get; set; }
    public string RiskLevel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string[] Factors { get; set; } = [];
    public string ModelName { get; set; } = "FraudGuard Hybrid Risk Model";
}

public class AdminPredictionDetailDto : AdminPredictionDto
{
    public AdminTransactionInfoDto? Transaction { get; set; }
    public AdminUserInfoDto User { get; set; } = new();
    public string SuggestedAction { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string DecisionSummary { get; set; } = string.Empty;
    public AdminAlertSummaryDto? Alert { get; set; }
}

public class AdminTransactionAnalysisDto
{
    public AdminTransactionDetailDto Transaction { get; set; } = new();
    public AdminPredictionDetailDto Prediction { get; set; } = new();
    public bool AlertCreated { get; set; }
}

public class AdminPredictionSummaryDto
{
    public int Id { get; set; }
    public int RiskScore { get; set; }
    public string RiskLevel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string[] Factors { get; set; } = [];
    public string SuggestedAction { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminAlertSummaryDto
{
    public int Id { get; set; }
    public string Severity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AdminTransactionInfoDto
{
    public int Id { get; set; }
    public string Merchant { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AdminUserInfoDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
}
