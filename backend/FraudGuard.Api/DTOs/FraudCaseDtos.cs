namespace FraudGuard.Api.DTOs;

public class FraudCaseSummaryDto
{
    public int OpenCases { get; set; }

    public int AssignedToMe { get; set; }

    public int HighRiskTransactions { get; set; }

    public int CasesResolvedToday { get; set; }

    public double AverageReviewTimeMinutes { get; set; }

    public int ConfirmedFraudCases { get; set; }
}

public class FraudCaseListResponseDto
{
    public FraudCaseSummaryDto Summary { get; set; } = new();

    public FraudCaseDto[] Items { get; set; } = [];

    public int Total { get; set; }

    public int Page { get; set; }

    public int PageSize { get; set; }
}

public class FraudCaseDto
{
    public int Id { get; set; }

    public int TransactionId { get; set; }

    public int? PredictionId { get; set; }

    public int? FraudAlertId { get; set; }

    public int? AssignedAnalystId { get; set; }

    public string? AssignedAnalystName { get; set; }

    public string CustomerName { get; set; } = string.Empty;

    public string CustomerEmail { get; set; } = string.Empty;

    public string Merchant { get; set; } = string.Empty;

    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string? SourceAccount { get; set; }

    public string? BeneficiaryName { get; set; }

    public int ModelRiskScore { get; set; }

    public string ModelDecision { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string Priority { get; set; } = string.Empty;

    public string? FinalDecision { get; set; }

    public string? AnalystComment { get; set; }

    public string[] ModelReasons { get; set; } = [];

    public string[] RelatedAlerts { get; set; } = [];

    public DateTime CreatedAt { get; set; }

    public DateTime? AssignedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
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
