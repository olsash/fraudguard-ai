namespace FraudGuard.Api.DTOs;

public class FraudCaseSummaryDto
{
    public int OpenCases { get; set; }

    public int AssignedToMe { get; set; }

    public int HighRiskTransactions { get; set; }

    public int UnassignedCases { get; set; }

    public int UnderReviewCases { get; set; }

    public int CasesResolvedToday { get; set; }

    public double AverageReviewTimeMinutes { get; set; }

    public int ConfirmedFraudCases { get; set; }

    public int FalsePositiveCases { get; set; }
}

public class FraudCaseListResponseDto
{
    public FraudCaseSummaryDto Summary { get; set; } = new();

    public FraudCaseDto[] Items { get; set; } = [];

    public int Total { get; set; }

    public int TotalItems { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalPages { get; set; }
}

public class AnalystTransactionListResponseDto
{
    public AnalystTransactionSummaryDto Summary { get; set; } = new();

    public AnalystTransactionDto[] Items { get; set; } = [];

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalItems { get; set; }

    public int TotalPages { get; set; }
}

public class AnalystTransactionSummaryDto
{
    public int TotalTransactions { get; set; }

    public int PendingReview { get; set; }

    public int UnderReview { get; set; }

    public int ConfirmedFraud { get; set; }

    public int FalsePositives { get; set; }

    public decimal TotalAmount { get; set; }

    public double AverageRisk { get; set; }
}

public class AnalystTransactionDto
{
    public int TransactionId { get; set; }

    public string TransactionReference { get; set; } = string.Empty;

    public int FraudCaseId { get; set; }

    public string CaseReference { get; set; } = string.Empty;

    public int CustomerId { get; set; }

    public string CustomerName { get; set; } = string.Empty;

    public string TransactionType { get; set; } = string.Empty;

    public string? MerchantName { get; set; }

    public string? BeneficiaryName { get; set; }

    public decimal Amount { get; set; }

    public string Currency { get; set; } = "EUR";

    public int ModelRiskScore { get; set; }

    public string ModelRiskLevel { get; set; } = string.Empty;

    public string ModelDecision { get; set; } = string.Empty;

    public string ProcessingStatus { get; set; } = string.Empty;

    public string CaseStatus { get; set; } = string.Empty;

    public string? AnalystDecision { get; set; }

    public int? AssignedAnalystId { get; set; }

    public string? AssignedAnalystName { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime? RejectedAt { get; set; }

    public bool CanClaim { get; set; }

    public bool CanReview { get; set; }
}

public class FraudCaseDto
{
    public int Id { get; set; }

    public string CaseReference { get; set; } = string.Empty;

    public int TransactionId { get; set; }

    public string TransactionReference { get; set; } = string.Empty;

    public int? PredictionId { get; set; }

    public int? FraudAlertId { get; set; }

    public int? AssignedAnalystId { get; set; }

    public string? AssignedAnalystName { get; set; }

    public string CustomerName { get; set; } = string.Empty;

    public string CustomerEmail { get; set; } = string.Empty;

    public bool CustomerIsActive { get; set; }

    public DateTime? CustomerCreatedAt { get; set; }

    public string Merchant { get; set; } = string.Empty;

    public string? MerchantCode { get; set; }

    public string? MerchantCategory { get; set; }

    public string? MerchantCountry { get; set; }

    public string? MerchantBankName { get; set; }

    public string? MerchantRiskLevel { get; set; }

    public string? MaskedMerchantSettlementAccount { get; set; }

    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string? SourceAccount { get; set; }

    public string? SourceBank { get; set; }

    public string? SourceIban { get; set; }

    public string? BeneficiaryName { get; set; }

    public string? DestinationBank { get; set; }

    public string? DestinationAccount { get; set; }

    public decimal? OldBalanceOrigin { get; set; }

    public decimal? NewBalanceOrigin { get; set; }

    public decimal? OldBalanceDestination { get; set; }

    public decimal? NewBalanceDestination { get; set; }

    public string ProcessingStatus { get; set; } = string.Empty;

    public int ModelRiskScore { get; set; }

    public string ModelDecision { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Priority { get; set; } = string.Empty;

    public string? FinalDecision { get; set; }

    public string? AnalystDecision { get; set; }

    public string? AnalystComment { get; set; }

    public string? AlertSeverity { get; set; }

    public string? AlertStatus { get; set; }

    public DateTime? AlertCreatedAt { get; set; }

    public string? ModelName { get; set; }

    public string? ModelVersion { get; set; }

    public string? PredictedClass { get; set; }

    public DateTime? PredictionCreatedAt { get; set; }

    public bool CanClaim { get; set; }

    public bool CanReview { get; set; }

    public string[] ModelReasons { get; set; } = [];

    public string[] RelatedAlerts { get; set; } = [];

    public FraudCaseNoteDto[] Notes { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime? AssignedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime? ReviewStartedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class FraudCaseNoteDto
{
    public int Id { get; set; }

    public int AnalystId { get; set; }

    public string AnalystName { get; set; } = string.Empty;

    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public class FraudCaseCommentRequest
{
    public string Comment { get; set; } = string.Empty;
}

public class FraudCaseResolveRequest
{
    public string FinalDecision { get; set; } = string.Empty;

    public string? Comment { get; set; }
}

public class FraudCaseAssignRequest
{
    public int AnalystId { get; set; }
}
