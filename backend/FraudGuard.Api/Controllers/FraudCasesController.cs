using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = ApplicationRoles.AdminOrFraudAnalyst)]
[Route("api/fraud-cases")]
public class FraudCasesController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ISystemLogService _systemLogService;

    public FraudCasesController(AppDbContext dbContext, ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _systemLogService = systemLogService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FraudCaseSummaryDto>> Summary(CancellationToken cancellationToken)
    {
        var analystId = GetCurrentUserId();
        return Ok(await BuildSummaryAsync(analystId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<FraudCaseListResponseDto>> List(
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? transactionType,
        [FromQuery] int? minRisk,
        [FromQuery] int? maxRisk,
        [FromQuery] string? assigned,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var analystId = GetCurrentUserId();
        var query = BaseQuery();

        query = ApplyFilters(query, status, priority, transactionType, minRisk, maxRisk, assigned, analystId, fromDate, toDate);
        query = ApplySorting(query, sortBy, sortDirection);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);

        return Ok(new FraudCaseListResponseDto
        {
            Summary = await BuildSummaryAsync(analystId, cancellationToken),
            Items = items.Select(ToDto).ToArray(),
            Total = total,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FraudCaseDto>> Details(int id, CancellationToken cancellationToken)
    {
        var fraudCase = await BaseQuery().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return fraudCase is null ? NotFound(new { message = "Fraud case not found." }) : Ok(ToDto(fraudCase));
    }

    [HttpPost("{id:int}/claim")]
    public async Task<ActionResult<FraudCaseDto>> Claim(int id, CancellationToken cancellationToken)
    {
        var analystId = GetCurrentUserId();
        if (analystId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var fraudCase = await LoadTrackedCaseAsync(id, cancellationToken);
        if (fraudCase is null)
        {
            return NotFound(new { message = "Fraud case not found." });
        }

        if (fraudCase.AssignedAnalystId.HasValue && fraudCase.AssignedAnalystId != analystId && !User.IsInRole(ApplicationRoles.Admin))
        {
            return Forbid();
        }

        fraudCase.AssignedAnalystId = analystId.Value;
        fraudCase.Status = "Assigned";
        fraudCase.AssignedAt ??= DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;
        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} claimed.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(fraudCase));
    }

    [HttpPut("{id:int}/assign")]
    [Authorize(Roles = ApplicationRoles.Admin)]
    public async Task<ActionResult<FraudCaseDto>> Assign(int id, FraudCaseAssignRequest request, CancellationToken cancellationToken)
    {
        var analyst = await _dbContext.Users.FirstOrDefaultAsync(user => user.Id == request.AnalystId && user.Role == ApplicationRoles.FraudAnalyst && user.IsActive, cancellationToken);
        if (analyst is null)
        {
            return BadRequest(new { message = "Select an active Fraud Analyst user." });
        }

        var fraudCase = await LoadTrackedCaseAsync(id, cancellationToken);
        if (fraudCase is null)
        {
            return NotFound(new { message = "Fraud case not found." });
        }

        if (IsResolved(fraudCase))
        {
            return BadRequest(new { message = "Fraud case has already been resolved." });
        }
        fraudCase.AssignedAnalystId = analyst.Id;
        fraudCase.Status = "Assigned";
        fraudCase.AssignedAt = DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;
        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} assigned to {analyst.FullName}.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(fraudCase));
    }

    [HttpPost("{id:int}/comment")]
    public async Task<ActionResult<FraudCaseDto>> Comment(int id, FraudCaseCommentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Comment))
        {
            return BadRequest(new { message = "Comment is required." });
        }

        var fraudCase = await LoadTrackedCaseAsync(id, cancellationToken);
        if (fraudCase is null)
        {
            return NotFound(new { message = "Fraud case not found." });
        }

        var guard = GuardCanModify(fraudCase);
        if (guard is not null)
        {
            return guard;
        }

        if (IsResolved(fraudCase))
        {
            return BadRequest(new { message = "Fraud case has already been resolved." });
        }
        fraudCase.AnalystComment = request.Comment.Trim();
        fraudCase.ReviewedAt ??= DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;
        await _systemLogService.LogAsync("Success", "case", $"Analyst comment added to fraud case FC-{fraudCase.Id}.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(fraudCase));
    }

    [HttpPost("{id:int}/under-review")]
    public Task<ActionResult<FraudCaseDto>> UnderReview(int id, CancellationToken cancellationToken)
    {
        return UpdateCaseStatusAsync(id, "UnderReview", cancellationToken);
    }

    [HttpPost("{id:int}/escalate")]
    public Task<ActionResult<FraudCaseDto>> Escalate(int id, CancellationToken cancellationToken)
    {
        return UpdateCaseStatusAsync(id, "Escalated", cancellationToken);
    }

    [HttpPost("{id:int}/approve")]
    public Task<ActionResult<FraudCaseDto>> Approve(int id, FraudCaseCommentRequest? request, CancellationToken cancellationToken)
    {
        return ResolveWithDecisionAsync(id, "Approved", request?.Comment, applyBalances: true, cancellationToken);
    }

    [HttpPost("{id:int}/confirm-fraud")]
    public Task<ActionResult<FraudCaseDto>> ConfirmFraud(int id, FraudCaseCommentRequest? request, CancellationToken cancellationToken)
    {
        return ResolveWithDecisionAsync(id, "ConfirmedFraud", request?.Comment, applyBalances: false, cancellationToken);
    }

    [HttpPost("{id:int}/resolve")]
    public async Task<ActionResult<FraudCaseDto>> Resolve(int id, FraudCaseResolveRequest request, CancellationToken cancellationToken)
    {
        var decision = NormalizeFinalDecision(request.FinalDecision);
        if (decision is null)
        {
            return BadRequest(new { message = "Final decision must be Approved, ConfirmedFraud, FalsePositive, or Rejected." });
        }

        return await ResolveWithDecisionAsync(id, decision, request.Comment, applyBalances: decision is "Approved" or "FalsePositive", cancellationToken);
    }

    private async Task<ActionResult<FraudCaseDto>> UpdateCaseStatusAsync(int id, string status, CancellationToken cancellationToken)
    {
        var fraudCase = await LoadTrackedCaseAsync(id, cancellationToken);
        if (fraudCase is null)
        {
            return NotFound(new { message = "Fraud case not found." });
        }

        var guard = GuardCanModify(fraudCase);
        if (guard is not null)
        {
            return guard;
        }

        if (IsResolved(fraudCase))
        {
            return BadRequest(new { message = "Fraud case has already been resolved." });
        }
        fraudCase.Status = status;
        fraudCase.ReviewedAt ??= DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;
        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} marked {status}.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(fraudCase));
    }

    private async Task<ActionResult<FraudCaseDto>> ResolveWithDecisionAsync(int id, string decision, string? comment, bool applyBalances, CancellationToken cancellationToken)
    {
        await using var dbTransaction = IsInMemoryDatabase()
            ? null
            : await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var fraudCase = await LoadTrackedCaseAsync(id, cancellationToken);
        if (fraudCase is null)
        {
            return NotFound(new { message = "Fraud case not found." });
        }

        var guard = GuardCanModify(fraudCase);
        if (guard is not null)
        {
            return guard;
        }

        if (fraudCase.ResolvedAt.HasValue || fraudCase.Status == "Resolved")
        {
            return BadRequest(new { message = "Fraud case has already been resolved." });
        }

        var transaction = fraudCase.Transaction;
        if (transaction is null)
        {
            return BadRequest(new { message = "Case transaction is missing." });
        }

        if (applyBalances)
        {
            var sourceAccount = await _dbContext.BankAccounts.FirstOrDefaultAsync(account => account.Id == transaction.SourceBankAccountId, cancellationToken);
            if (sourceAccount is null || !sourceAccount.IsActive)
            {
                return BadRequest(new { message = "Source account is no longer active." });
            }

            if (sourceAccount.CurrentBalance < transaction.Amount)
            {
                return BadRequest(new { message = "Source account balance is no longer sufficient to approve this transaction." });
            }

            var destinationAccount = await ResolveDestinationAccountAsync(transaction, cancellationToken);
            sourceAccount.CurrentBalance -= transaction.Amount;
            sourceAccount.UpdatedAt = DateTime.UtcNow;

            if (destinationAccount is not null)
            {
                destinationAccount.CurrentBalance += transaction.Amount;
                destinationAccount.UpdatedAt = DateTime.UtcNow;
            }

            transaction.Status = "safe";
            transaction.ProcessingStatus = "Completed";
            await _systemLogService.LogAsync("Success", "transaction", $"Pending transaction TX-{transaction.Id} approved and completed.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        }
        else
        {
            transaction.Status = "fraud";
            transaction.ProcessingStatus = "Rejected";
            await _systemLogService.LogAsync("Warning", "transaction", $"Pending transaction TX-{transaction.Id} rejected after analyst review.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        }

        fraudCase.Status = "Resolved";
        fraudCase.FinalDecision = decision;
        fraudCase.AnalystComment = string.IsNullOrWhiteSpace(comment) ? fraudCase.AnalystComment : comment.Trim();
        fraudCase.ReviewedAt ??= DateTime.UtcNow;
        fraudCase.ResolvedAt = DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;

        if (fraudCase.FraudAlert is not null)
        {
            fraudCase.FraudAlert.Status = decision == "ConfirmedFraud" ? "resolved fraud" : "resolved";
        }

        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} resolved as {decision}.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (dbTransaction is not null)
        {
            await dbTransaction.CommitAsync(cancellationToken);
        }

        return Ok(ToDto(fraudCase));
    }

    private IQueryable<FraudCase> BaseQuery()
    {
        return _dbContext.FraudCases
            .AsNoTracking()
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.User)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.SourceBankAccount)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)
            .Include(item => item.Prediction)
            .Include(item => item.FraudAlert)
            .Include(item => item.AssignedAnalyst);
    }

    private async Task<FraudCase?> LoadTrackedCaseAsync(int id, CancellationToken cancellationToken)
    {
        return await _dbContext.FraudCases
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.User)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.SourceBankAccount)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)
            .Include(item => item.Prediction)
            .Include(item => item.FraudAlert)
            .Include(item => item.AssignedAnalyst)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
    }

    private static IQueryable<FraudCase> ApplyFilters(
        IQueryable<FraudCase> query,
        string? status,
        string? priority,
        string? transactionType,
        int? minRisk,
        int? maxRisk,
        string? assigned,
        int? analystId,
        DateTime? fromDate,
        DateTime? toDate)
    {
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(item => item.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(priority))
        {
            query = query.Where(item => item.Priority == priority);
        }

        if (!string.IsNullOrWhiteSpace(transactionType))
        {
            query = query.Where(item => item.Transaction != null && item.Transaction.TransactionType == transactionType);
        }

        if (minRisk.HasValue)
        {
            query = query.Where(item => item.ModelRiskScore >= minRisk.Value);
        }

        if (maxRisk.HasValue)
        {
            query = query.Where(item => item.ModelRiskScore <= maxRisk.Value);
        }

        if (assigned == "mine" && analystId.HasValue)
        {
            query = query.Where(item => item.AssignedAnalystId == analystId.Value);
        }
        else if (assigned == "unassigned")
        {
            query = query.Where(item => item.AssignedAnalystId == null);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(item => item.CreatedAt >= fromDate.Value.Date);
        }

        if (toDate.HasValue)
        {
            query = query.Where(item => item.CreatedAt < toDate.Value.Date.AddDays(1));
        }

        return query;
    }

    private static IQueryable<FraudCase> ApplySorting(IQueryable<FraudCase> query, string? sortBy, string? direction)
    {
        var desc = !string.Equals(direction, "asc", StringComparison.OrdinalIgnoreCase);
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "risk" => desc ? query.OrderByDescending(item => item.ModelRiskScore) : query.OrderBy(item => item.ModelRiskScore),
            "priority" => desc ? query.OrderByDescending(item => item.Priority) : query.OrderBy(item => item.Priority),
            "status" => desc ? query.OrderByDescending(item => item.Status) : query.OrderBy(item => item.Status),
            _ => desc ? query.OrderByDescending(item => item.CreatedAt) : query.OrderBy(item => item.CreatedAt)
        };
    }

    private async Task<FraudCaseSummaryDto> BuildSummaryAsync(int? analystId, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var resolved = _dbContext.FraudCases.AsNoTracking().Where(item => item.ResolvedAt.HasValue);
        var resolvedRows = await resolved.Select(item => new { item.CreatedAt, item.ResolvedAt }).ToListAsync(cancellationToken);

        return new FraudCaseSummaryDto
        {
            OpenCases = await _dbContext.FraudCases.CountAsync(item => item.Status != "Resolved", cancellationToken),
            AssignedToMe = analystId.HasValue ? await _dbContext.FraudCases.CountAsync(item => item.AssignedAnalystId == analystId.Value && item.Status != "Resolved", cancellationToken) : 0,
            HighRiskTransactions = await _dbContext.FraudCases.CountAsync(item => item.ModelRiskScore >= 70 && item.Status != "Resolved", cancellationToken),
            CasesResolvedToday = await _dbContext.FraudCases.CountAsync(item => item.ResolvedAt >= today, cancellationToken),
            AverageReviewTimeMinutes = resolvedRows.Count == 0 ? 0 : Math.Round(resolvedRows.Average(item => (item.ResolvedAt!.Value - item.CreatedAt).TotalMinutes), 1),
            ConfirmedFraudCases = await _dbContext.FraudCases.CountAsync(item => item.FinalDecision == "ConfirmedFraud", cancellationToken)
        };
    }

    private async Task<BankAccount?> ResolveDestinationAccountAsync(Transaction transaction, CancellationToken cancellationToken)
    {
        if (transaction.MerchantId.HasValue)
        {
            return await _dbContext.Merchants
                .Where(merchant => merchant.Id == transaction.MerchantId.Value)
                .Select(merchant => merchant.SettlementBankAccount)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (transaction.BeneficiaryId.HasValue)
        {
            return await _dbContext.Beneficiaries
                .Where(beneficiary => beneficiary.Id == transaction.BeneficiaryId.Value)
                .Select(beneficiary => beneficiary.DestinationBankAccount)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return null;
    }

    private ActionResult? GuardCanModify(FraudCase fraudCase)
    {
        if (User.IsInRole(ApplicationRoles.Admin))
        {
            return null;
        }

        var analystId = GetCurrentUserId();
        if (!analystId.HasValue || fraudCase.AssignedAnalystId != analystId.Value)
        {
            return Forbid();
        }

        return null;
    }

    private static bool IsResolved(FraudCase fraudCase)
    {
        return fraudCase.ResolvedAt.HasValue || fraudCase.Status == "Resolved";
    }

    private static string? NormalizeFinalDecision(string? decision)
    {
        if (string.IsNullOrWhiteSpace(decision))
        {
            return null;
        }

        var normalized = decision.Trim().Replace(" ", string.Empty, StringComparison.OrdinalIgnoreCase);
        return normalized.ToLowerInvariant() switch
        {
            "approved" => "Approved",
            "confirmedfraud" => "ConfirmedFraud",
            "falsepositive" => "FalsePositive",
            "rejected" => "Rejected",
            _ => null
        };
    }

    private static FraudCaseDto ToDto(FraudCase fraudCase)
    {
        var transaction = fraudCase.Transaction;
        var prediction = fraudCase.Prediction;
        return new FraudCaseDto
        {
            Id = fraudCase.Id,
            TransactionId = fraudCase.TransactionId,
            PredictionId = fraudCase.PredictionId,
            FraudAlertId = fraudCase.FraudAlertId,
            AssignedAnalystId = fraudCase.AssignedAnalystId,
            AssignedAnalystName = fraudCase.AssignedAnalyst?.FullName,
            CustomerName = transaction?.User?.FullName ?? "Unknown customer",
            CustomerEmail = transaction?.User?.Email ?? string.Empty,
            Merchant = transaction?.Merchant ?? string.Empty,
            TransactionType = transaction?.TransactionType ?? string.Empty,
            Amount = transaction?.Amount ?? 0,
            Currency = transaction?.Currency ?? "EUR",
            SourceAccount = transaction?.SourceBankAccount is null ? null : Mask(transaction.SourceBankAccount.AccountNumber),
            BeneficiaryName = transaction?.Beneficiary?.FullName,
            ModelRiskScore = fraudCase.ModelRiskScore,
            ModelDecision = fraudCase.ModelDecision,
            Status = fraudCase.Status,
            Priority = fraudCase.Priority,
            FinalDecision = fraudCase.FinalDecision,
            AnalystComment = fraudCase.AnalystComment,
            ModelReasons = prediction is null ? [] : ReadReasons(prediction.Explanation),
            RelatedAlerts = fraudCase.FraudAlert is null ? [] : [$"{fraudCase.FraudAlert.Title} ({fraudCase.FraudAlert.Status})"],
            CreatedAt = fraudCase.CreatedAt,
            AssignedAt = fraudCase.AssignedAt,
            ReviewedAt = fraudCase.ReviewedAt,
            ResolvedAt = fraudCase.ResolvedAt,
            UpdatedAt = fraudCase.UpdatedAt
        };
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static string[] ReadReasons(string explanation)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(explanation) ?? [];
        }
        catch (JsonException)
        {
            return string.IsNullOrWhiteSpace(explanation) ? [] : [explanation];
        }
    }

    private static string Mask(string value)
    {
        var trimmed = value.Trim();
        var lastFour = trimmed.Length <= 4 ? trimmed : trimmed[^4..];
        return $"**** {lastFour}";
    }

    private bool IsInMemoryDatabase()
    {
        return _dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }
}
