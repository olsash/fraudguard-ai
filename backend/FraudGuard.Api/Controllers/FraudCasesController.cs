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
[Route("api/analyst/cases")]
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
    [HttpGet("/api/analyst/review-queue")]
    public async Task<ActionResult<FraudCaseListResponseDto>> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? transactionType,
        [FromQuery(Name = "type")] string? transactionTypeAlias,
        [FromQuery] int? minRisk,
        [FromQuery] int? maxRisk,
        [FromQuery] string? assigned,
        [FromQuery(Name = "assignment")] string? assignment,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery(Name = "from")] DateTime? from,
        [FromQuery(Name = "to")] DateTime? to,
        [FromQuery] string? sortBy,
        [FromQuery(Name = "sort")] string? sort,
        [FromQuery] string? sortDirection,
        [FromQuery(Name = "direction")] string? direction,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var analystId = GetCurrentUserId();
        var query = BaseQuery();

        query = ApplyFilters(query, search, status, priority, transactionType ?? transactionTypeAlias, minRisk, maxRisk, assignment ?? assigned, analystId, fromDate ?? from, toDate ?? to);
        query = ApplySorting(query, sortBy ?? sort, sortDirection ?? direction);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));

        return Ok(new FraudCaseListResponseDto
        {
            Summary = await BuildSummaryAsync(analystId, cancellationToken),
            Items = items.Select(item => ToDto(item, analystId, User.IsInRole(ApplicationRoles.Admin))).ToArray(),
            Total = total,
            TotalItems = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    [HttpGet("/api/analyst/alerts")]
    public async Task<ActionResult<FraudCaseListResponseDto>> AnalystAlerts(
        [FromQuery] string? scope,
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? severity,
        [FromQuery] string? transactionType,
        [FromQuery] int? minRisk,
        [FromQuery] int? maxRisk,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        return await AnalystScopedCases(scope ?? "mine", search, status, priority, severity, transactionType, minRisk, maxRisk, from, to, page, pageSize, cancellationToken);
    }

    [HttpGet("/api/analyst/predictions")]
    public async Task<ActionResult<FraudCaseListResponseDto>> AnalystPredictions(
        [FromQuery] string? scope,
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? modelResult,
        [FromQuery] string? riskLevel,
        [FromQuery] string? transactionType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var minRisk = riskLevel?.Trim().ToLowerInvariant() switch
        {
            "high" => 70,
            "medium" or "review" => 40,
            _ => (int?)null
        };
        var maxRisk = riskLevel?.Trim().ToLowerInvariant() switch
        {
            "medium" or "review" => 69,
            _ => (int?)null
        };

        var result = await AnalystScopedCases(scope ?? "reviewRequired", search, status, priority, null, transactionType, minRisk, maxRisk, from, to, page, pageSize, cancellationToken, modelResult);
        return result;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FraudCaseDto>> Details(int id, CancellationToken cancellationToken)
    {
        var fraudCase = await BaseQuery().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return fraudCase is null ? NotFound(new { message = "Fraud case not found." }) : Ok(ToDto(fraudCase, GetCurrentUserId(), User.IsInRole(ApplicationRoles.Admin)));
    }

    private async Task<ActionResult<FraudCaseListResponseDto>> AnalystScopedCases(
        string scope,
        string? search,
        string? status,
        string? priority,
        string? severity,
        string? transactionType,
        int? minRisk,
        int? maxRisk,
        DateTime? from,
        DateTime? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken,
        string? modelResult = null)
    {
        var analystId = GetCurrentUserId();
        if (analystId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var isAdmin = User.IsInRole(ApplicationRoles.Admin);
        var query = BaseQuery().Where(item => item.FraudAlertId != null || item.PredictionId != null);

        if (!isAdmin)
        {
            query = ApplyAnalystScope(query, scope, analystId.Value);
        }

        query = ApplyFilters(query, search, status, priority, transactionType, minRisk, maxRisk, null, analystId, from, to);

        if (!string.IsNullOrWhiteSpace(severity) && severity != "all")
        {
            var normalizedSeverity = severity.Trim().ToLowerInvariant();
            query = query.Where(item => item.FraudAlert != null && item.FraudAlert.Severity.ToLower() == normalizedSeverity);
        }

        var normalizedModelResult = modelResult?.Trim().ToLowerInvariant();
        if (normalizedModelResult is "fraud")
        {
            query = query.Where(item => item.Prediction != null && item.Prediction.IsFraud);
        }
        else if (normalizedModelResult is "not_fraud" or "not-fraud" or "notfraud")
        {
            query = query.Where(item => item.Prediction != null && !item.Prediction.IsFraud);
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        query = ApplySorting(query, "priority", "desc");
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));

        return Ok(new FraudCaseListResponseDto
        {
            Summary = await BuildSummaryAsync(analystId, cancellationToken),
            Items = items.Select(item => ToDto(item, analystId, isAdmin)).ToArray(),
            Total = total,
            TotalItems = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    private static IQueryable<FraudCase> ApplyAnalystScope(IQueryable<FraudCase> query, string scope, int analystId)
    {
        return scope.Trim().Replace("-", string.Empty, StringComparison.OrdinalIgnoreCase).ToLowerInvariant() switch
        {
            "unassigned" => query.Where(item => item.AssignedAnalystId == null && item.Status == "Open" && item.ResolvedAt == null),
            "resolved" or "resolvedbyme" => query.Where(item => item.AssignedAnalystId == analystId && item.Status == "Resolved"),
            "reviewable" or "reviewrequired" => query.Where(item => item.ResolvedAt == null && (item.AssignedAnalystId == analystId || item.AssignedAnalystId == null)),
            _ => query.Where(item => item.AssignedAnalystId == analystId && item.Status != "Resolved")
        };
    }

    [HttpPost("{id:int}/claim")]
    public async Task<ActionResult<FraudCaseDto>> Claim(int id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(ApplicationRoles.FraudAnalyst))
        {
            return Forbid();
        }

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

        if (IsResolved(fraudCase))
        {
            return Conflict(new { message = "Fraud case has already been resolved." });
        }

        if (fraudCase.AssignedAnalystId.HasValue)
        {
            return Conflict(new { message = "This case has already been assigned to another analyst." });
        }

        var now = DateTime.UtcNow;
        var previousStatus = fraudCase.Status;
        fraudCase.AssignedAnalystId = analystId.Value;
        fraudCase.Status = "UnderReview";
        fraudCase.AssignedAt ??= now;
        fraudCase.ReviewStartedAt ??= now;
        fraudCase.UpdatedAt = now;
        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} claimed and review started. Previous status: {previousStatus}; new status: UnderReview.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This case has already been assigned to another analyst." });
        }

        return Ok(ToDto(fraudCase, analystId, isAdmin: false));
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
        var now = DateTime.UtcNow;
        fraudCase.AssignedAnalystId = analyst.Id;
        fraudCase.Status = "UnderReview";
        fraudCase.AssignedAt ??= now;
        fraudCase.ReviewStartedAt ??= now;
        fraudCase.UpdatedAt = now;
        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} assigned to {analyst.FullName}.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(fraudCase, GetCurrentUserId(), isAdmin: true));
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
        AddNote(fraudCase, request.Comment.Trim());
        fraudCase.AnalystComment = request.Comment.Trim();
        fraudCase.ReviewedAt ??= DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;
        await _systemLogService.LogAsync("Success", "case", $"Analyst comment added to fraud case FC-{fraudCase.Id}.", fraudCase.Transaction?.UserId, fraudCase.Transaction?.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(fraudCase, GetCurrentUserId(), User.IsInRole(ApplicationRoles.Admin)));
    }

    [HttpPost("{id:int}/notes")]
    public async Task<ActionResult<FraudCaseDto>> AddNoteEndpoint(int id, FraudCaseCommentRequest request, CancellationToken cancellationToken)
    {
        return await Comment(id, request, cancellationToken);
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

    [HttpPost("{id:int}/false-positive")]
    public Task<ActionResult<FraudCaseDto>> FalsePositive(int id, FraudCaseCommentRequest? request, CancellationToken cancellationToken)
    {
        return ResolveWithDecisionAsync(id, "FalsePositive", request?.Comment, applyBalances: true, cancellationToken);
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
            return Conflict(new { message = "Fraud case has already been resolved." });
        }

        if (fraudCase.Status != "UnderReview")
        {
            return Conflict(new { message = "Fraud case must be claimed and under review before a final decision can be made." });
        }

        var transaction = fraudCase.Transaction;
        if (transaction is null)
        {
            return BadRequest(new { message = "Case transaction is missing." });
        }

        if (transaction.ProcessingStatus is not ("PendingReview" or "BlockedPendingReview"))
        {
            return Conflict(new { message = "Only transactions pending analyst review can be resolved from a fraud case." });
        }

        if (decision is "ConfirmedFraud" or "FalsePositive" && string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { message = "Analyst comment is required for this decision." });
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
                return Conflict(new { message = "Source account balance is no longer sufficient to approve this transaction." });
            }

            var destinationAccount = await ResolveDestinationAccountAsync(transaction, cancellationToken);
            var expectedNewOrigin = transaction.NewBalanceOrigin;
            if (expectedNewOrigin.HasValue && expectedNewOrigin.Value != sourceAccount.CurrentBalance - transaction.Amount)
            {
                return Conflict(new { message = "Source account balance changed while this transaction was under review." });
            }

            if (destinationAccount is not null)
            {
                if (!destinationAccount.IsActive)
                {
                    return Conflict(new { message = "Destination account is no longer active." });
                }

                if (transaction.OldBalanceDestination.HasValue && destinationAccount.CurrentBalance != transaction.OldBalanceDestination.Value)
                {
                    return Conflict(new { message = "Destination account balance changed while this transaction was under review." });
                }
            }

            sourceAccount.CurrentBalance -= transaction.Amount;
            sourceAccount.UpdatedAt = DateTime.UtcNow;

            if (destinationAccount is not null)
            {
                destinationAccount.CurrentBalance += transaction.Amount;
                destinationAccount.UpdatedAt = DateTime.UtcNow;
            }

            transaction.Status = "safe";
            transaction.ProcessingStatus = "Completed";
            transaction.CompletedAt ??= DateTime.UtcNow;
            await _systemLogService.LogAsync("Success", "transaction", $"Pending transaction TX-{transaction.Id} approved and completed.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        }
        else
        {
            transaction.Status = "fraud";
            transaction.ProcessingStatus = "Rejected";
            transaction.RejectedAt ??= DateTime.UtcNow;
            await _systemLogService.LogAsync("Warning", "transaction", $"Pending transaction TX-{transaction.Id} rejected after analyst review.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        }

        fraudCase.Status = "Resolved";
        fraudCase.FinalDecision = decision;
        fraudCase.AnalystComment = string.IsNullOrWhiteSpace(comment) ? fraudCase.AnalystComment : comment.Trim();
        if (!string.IsNullOrWhiteSpace(comment))
        {
            AddNote(fraudCase, comment.Trim());
        }
        fraudCase.ReviewedAt ??= DateTime.UtcNow;
        fraudCase.ResolvedAt = DateTime.UtcNow;
        fraudCase.UpdatedAt = DateTime.UtcNow;

        if (fraudCase.FraudAlert is not null)
        {
            fraudCase.FraudAlert.Status = decision switch
            {
                "ConfirmedFraud" => "ConfirmedFraud",
                "FalsePositive" => "FalsePositive",
                _ => "Resolved"
            };
        }

        await _systemLogService.LogAsync("Success", "case", $"Fraud case FC-{fraudCase.Id} resolved as {decision}.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (dbTransaction is not null)
        {
            await dbTransaction.CommitAsync(cancellationToken);
        }

        return Ok(ToDto(fraudCase, GetCurrentUserId(), User.IsInRole(ApplicationRoles.Admin)));
    }

    private IQueryable<FraudCase> BaseQuery()
    {
        return _dbContext.FraudCases
            .AsNoTracking()
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.User)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.SourceBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)!.ThenInclude(beneficiary => beneficiary!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)!.ThenInclude(beneficiary => beneficiary!.DestinationBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.MerchantRecord)!.ThenInclude(merchant => merchant!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.MerchantRecord)!.ThenInclude(merchant => merchant!.SettlementBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Prediction)
            .Include(item => item.FraudAlert)
            .Include(item => item.AssignedAnalyst)
            .Include(item => item.Notes).ThenInclude(note => note.Analyst);
    }

    private async Task<FraudCase?> LoadTrackedCaseAsync(int id, CancellationToken cancellationToken)
    {
        return await _dbContext.FraudCases
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.User)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.SourceBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)!.ThenInclude(beneficiary => beneficiary!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.Beneficiary)!.ThenInclude(beneficiary => beneficiary!.DestinationBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.MerchantRecord)!.ThenInclude(merchant => merchant!.Bank)
            .Include(item => item.Transaction).ThenInclude(transaction => transaction!.MerchantRecord)!.ThenInclude(merchant => merchant!.SettlementBankAccount)!.ThenInclude(account => account!.Bank)
            .Include(item => item.Prediction)
            .Include(item => item.FraudAlert)
            .Include(item => item.AssignedAnalyst)
            .Include(item => item.Notes).ThenInclude(note => note.Analyst)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
    }

    private static IQueryable<FraudCase> ApplyFilters(
        IQueryable<FraudCase> query,
        string? search,
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
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var numericSearch = int.TryParse(term.TrimStart('F', 'C', 'T', 'X', '-', '#'), out var searchedId);
            query = query.Where(item =>
                (numericSearch && (item.Id == searchedId || item.TransactionId == searchedId))
                || (item.Transaction != null && item.Transaction.User != null && item.Transaction.User.FullName.Contains(term))
                || (item.Transaction != null && item.Transaction.User != null && item.Transaction.User.Email.Contains(term))
                || (item.Transaction != null && item.Transaction.Merchant.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(item => item.Status == NormalizeStatus(status));
        }

        if (!string.IsNullOrWhiteSpace(priority))
        {
            query = query.Where(item => item.Priority == NormalizePriority(priority));
        }

        if (!string.IsNullOrWhiteSpace(transactionType) && transactionType != "all")
        {
            var normalizedType = transactionType.Trim().ToUpperInvariant();
            query = query.Where(item => item.Transaction != null && item.Transaction.TransactionType == normalizedType);
        }

        if (minRisk.HasValue)
        {
            query = query.Where(item => item.ModelRiskScore >= minRisk.Value);
        }

        if (maxRisk.HasValue)
        {
            query = query.Where(item => item.ModelRiskScore <= maxRisk.Value);
        }

        var normalizedAssignment = assigned?.Trim().Replace("-", string.Empty, StringComparison.OrdinalIgnoreCase).ToLowerInvariant();
        if (normalizedAssignment is "mine" or "assignedtome" && analystId.HasValue)
        {
            query = query.Where(item => item.AssignedAnalystId == analystId.Value);
        }
        else if (normalizedAssignment == "unassigned")
        {
            query = query.Where(item => item.AssignedAnalystId == null);
        }
        else if (normalizedAssignment == "assignedtoothers" && analystId.HasValue)
        {
            query = query.Where(item => item.AssignedAnalystId.HasValue && item.AssignedAnalystId != analystId.Value);
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
            "risk" or "riskscore" => desc ? query.OrderByDescending(item => item.ModelRiskScore) : query.OrderBy(item => item.ModelRiskScore),
            "priority" => desc
                ? query.OrderByDescending(item => item.ModelRiskScore).ThenByDescending(item => item.CreatedAt)
                : query.OrderBy(item => item.ModelRiskScore).ThenByDescending(item => item.CreatedAt),
            "status" => desc ? query.OrderByDescending(item => item.Status) : query.OrderBy(item => item.Status),
            _ => query.OrderByDescending(item => item.ModelRiskScore).ThenByDescending(item => item.CreatedAt)
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
            UnassignedCases = await _dbContext.FraudCases.CountAsync(item => item.AssignedAnalystId == null && item.Status != "Resolved", cancellationToken),
            UnderReviewCases = await _dbContext.FraudCases.CountAsync(item => item.Status == "UnderReview", cancellationToken),
            CasesResolvedToday = await _dbContext.FraudCases.CountAsync(item => item.ResolvedAt >= today, cancellationToken),
            AverageReviewTimeMinutes = resolvedRows.Count == 0 ? 0 : Math.Round(resolvedRows.Average(item => (item.ResolvedAt!.Value - item.CreatedAt).TotalMinutes), 1),
            ConfirmedFraudCases = await _dbContext.FraudCases.CountAsync(item => item.FinalDecision == "ConfirmedFraud", cancellationToken),
            FalsePositiveCases = await _dbContext.FraudCases.CountAsync(item => item.FinalDecision == "FalsePositive", cancellationToken)
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

    private void AddNote(FraudCase fraudCase, string comment)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return;
        }

        fraudCase.Notes.Add(new FraudCaseNote
        {
            FraudCaseId = fraudCase.Id,
            AnalystId = userId.Value,
            Comment = comment,
            CreatedAt = DateTime.UtcNow
        });
    }

    private static FraudCaseDto ToDto(FraudCase fraudCase, int? currentUserId, bool isAdmin)
    {
        var transaction = fraudCase.Transaction;
        var prediction = fraudCase.Prediction;
        var destinationAccount = transaction?.Beneficiary?.DestinationBankAccount
            ?? transaction?.MerchantRecord?.SettlementBankAccount;
        var canClaim = !isAdmin
            && currentUserId.HasValue
            && fraudCase.AssignedAnalystId is null
            && !IsResolved(fraudCase);
        var canReview = isAdmin
            || (currentUserId.HasValue && fraudCase.AssignedAnalystId == currentUserId.Value && !IsResolved(fraudCase));

        return new FraudCaseDto
        {
            Id = fraudCase.Id,
            CaseReference = $"FC-{fraudCase.Id}",
            TransactionId = fraudCase.TransactionId,
            TransactionReference = $"TX-{fraudCase.TransactionId}",
            PredictionId = fraudCase.PredictionId,
            FraudAlertId = fraudCase.FraudAlertId,
            AssignedAnalystId = fraudCase.AssignedAnalystId,
            AssignedAnalystName = fraudCase.AssignedAnalyst?.FullName,
            CustomerName = transaction?.User?.FullName ?? "Unknown customer",
            CustomerEmail = transaction?.User?.Email ?? string.Empty,
            CustomerIsActive = transaction?.User?.IsActive ?? false,
            CustomerCreatedAt = transaction?.User?.CreatedAt,
            Merchant = transaction?.Merchant ?? string.Empty,
            MerchantCode = transaction?.MerchantRecord?.MerchantCode,
            MerchantCategory = transaction?.MerchantRecord?.Category,
            MerchantCountry = transaction?.MerchantRecord?.Country,
            MerchantBankName = transaction?.MerchantRecord?.Bank?.Name ?? transaction?.MerchantRecord?.SettlementBankAccount?.Bank?.Name,
            MerchantRiskLevel = transaction?.MerchantRecord?.RiskLevel,
            MaskedMerchantSettlementAccount = transaction?.MerchantRecord?.SettlementBankAccount is null ? null : Mask(transaction.MerchantRecord.SettlementBankAccount.AccountNumber),
            TransactionType = transaction?.TransactionType ?? string.Empty,
            Amount = transaction?.Amount ?? 0,
            Currency = transaction?.Currency ?? "EUR",
            SourceAccount = transaction?.SourceBankAccount is null ? null : Mask(transaction.SourceBankAccount.AccountNumber),
            SourceBank = transaction?.SourceBankAccount?.Bank?.Name,
            SourceIban = transaction?.SourceBankAccount is null ? null : MaskIban(transaction.SourceBankAccount.IBAN),
            BeneficiaryName = transaction?.Beneficiary?.FullName,
            DestinationBank = destinationAccount?.Bank?.Name ?? transaction?.Beneficiary?.Bank?.Name,
            DestinationAccount = destinationAccount is null ? null : Mask(destinationAccount.AccountNumber),
            OldBalanceOrigin = transaction?.OldBalanceOrigin,
            NewBalanceOrigin = transaction?.NewBalanceOrigin,
            OldBalanceDestination = transaction?.OldBalanceDestination,
            NewBalanceDestination = transaction?.NewBalanceDestination,
            ProcessingStatus = transaction?.ProcessingStatus ?? string.Empty,
            ModelRiskScore = fraudCase.ModelRiskScore,
            ModelDecision = fraudCase.ModelDecision,
            Status = fraudCase.Status,
            Priority = fraudCase.Priority,
            FinalDecision = fraudCase.FinalDecision,
            AnalystDecision = fraudCase.FinalDecision,
            AnalystComment = fraudCase.AnalystComment,
            AlertSeverity = fraudCase.FraudAlert?.Severity,
            AlertStatus = fraudCase.FraudAlert?.Status,
            AlertCreatedAt = fraudCase.FraudAlert?.CreatedAt,
            ModelName = "RandomForestClassifier",
            ModelVersion = "ONNX",
            PredictedClass = prediction is null ? fraudCase.ModelDecision : prediction.IsFraud ? "Fraud" : "Not fraud",
            PredictionCreatedAt = prediction?.CreatedAt,
            CanClaim = canClaim,
            CanReview = canReview,
            ModelReasons = prediction is null ? [] : ReadReasons(prediction.Explanation),
            RelatedAlerts = fraudCase.FraudAlert is null ? [] : [$"{fraudCase.FraudAlert.Title} ({fraudCase.FraudAlert.Status})"],
            Notes = fraudCase.Notes
                .OrderBy(note => note.CreatedAt)
                .Select(note => new FraudCaseNoteDto
                {
                    Id = note.Id,
                    AnalystId = note.AnalystId,
                    AnalystName = note.Analyst?.FullName ?? $"Analyst {note.AnalystId}",
                    Comment = note.Comment,
                    CreatedAt = note.CreatedAt
                })
                .ToArray(),
            CreatedAt = fraudCase.CreatedAt,
            AssignedAt = fraudCase.AssignedAt,
            ReviewedAt = fraudCase.ReviewedAt,
            ReviewStartedAt = fraudCase.ReviewStartedAt,
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

    private static string MaskIban(string value)
    {
        var normalized = value.Replace(" ", string.Empty, StringComparison.Ordinal).Trim();
        var lastFour = normalized.Length <= 4 ? normalized : normalized[^4..];
        return $"**** **** **** {lastFour}";
    }

    private static string NormalizeStatus(string status)
    {
        var normalized = status.Trim().Replace("-", string.Empty, StringComparison.OrdinalIgnoreCase).Replace("_", string.Empty, StringComparison.OrdinalIgnoreCase).ToLowerInvariant();
        return normalized switch
        {
            "underreview" => "UnderReview",
            "assigned" or "escalated" => "UnderReview",
            "resolved" => "Resolved",
            _ => "Open"
        };
    }

    private static string NormalizePriority(string priority)
    {
        var normalized = priority.Trim().ToLowerInvariant();
        return normalized switch
        {
            "critical" => "Critical",
            "high" => "High",
            "medium" => "Medium",
            "low" => "Low",
            _ => priority.Trim()
        };
    }

    private bool IsInMemoryDatabase()
    {
        return _dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }
}
