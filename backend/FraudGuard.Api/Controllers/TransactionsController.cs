using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using FraudGuard.Api.Security;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TransactionsController : ControllerBase
{
    private static readonly string[] FilterStatuses = ["pending", "safe", "review", "fraud"];
    private static readonly string[] FinalStatuses = ["safe", "review", "fraud"];

    private readonly AppDbContext _dbContext;
    private readonly IFraudPredictionService _predictionService;
    private readonly ISystemLogService _systemLogService;

    public TransactionsController(
        AppDbContext dbContext,
        IFraudPredictionService predictionService,
        ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _predictionService = predictionService;
        _systemLogService = systemLogService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TransactionResponseDto>>> GetTransactions(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var query = BuildScopedQuery(userId.Value);
        query = ApplyFilters(query, search, status, fromDate, toDate);

        var transactions = await query
            .OrderByDescending(transaction => transaction.CreatedAt)
            .Select(transaction => ToResponse(transaction))
            .ToListAsync(cancellationToken);

        return Ok(transactions);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TransactionResponseDto>> GetTransaction(int id, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var transaction = await BuildScopedQuery(userId.Value)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound(new { message = "Transaction not found." });
        }

        return Ok(ToResponse(transaction));
    }

    [HttpPost]
    public async Task<ActionResult<TransactionResponseDto>> CreateTransaction(CreateTransactionRequestDto request, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var normalizedKey = NormalizeOptional(request.IdempotencyKey);
            var existing = await _dbContext.Transactions
                .AsNoTracking()
                .Include(item => item.User)
                .Include(item => item.SourceBankAccount)
                .Include(item => item.Beneficiary)
                .Include(item => item.Predictions)
                .FirstOrDefaultAsync(item => item.UserId == userId.Value && item.IdempotencyKey == normalizedKey, cancellationToken);

            if (existing is not null)
            {
                return Ok(ToResponse(existing));
            }

            request.IdempotencyKey = normalizedKey;
        }

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Amount must be greater than 0." });
        }

        var transactionType = request.TransactionType.Trim().ToUpperInvariant();
        if (transactionType is not ("PAYMENT" or "TRANSFER" or "CASH_OUT" or "CASH_IN" or "DEBIT"))
        {
            return BadRequest(new { message = "Transaction type must be one of CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER." });
        }

        if (!request.SourceBankAccountId.HasValue)
        {
            return BadRequest(new { message = "Select a source account." });
        }

        var executionStrategy = _dbContext.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var dbTransaction = IsInMemoryDatabase()
                ? null
                : await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var result = await CreateTransactionCoreAsync(userId.Value, transactionType, request, cancellationToken);

            if (dbTransaction is not null)
            {
                await dbTransaction.CommitAsync(cancellationToken);
            }

            return result;
        });
    }

    private async Task<ActionResult<TransactionResponseDto>> CreateTransactionCoreAsync(
        int userId,
        string transactionType,
        CreateTransactionRequestDto request,
        CancellationToken cancellationToken)
    {
        var sourceAccount = request.SourceBankAccountId.HasValue
            ? await _dbContext.BankAccounts
                .Include(account => account.Bank)
                .FirstOrDefaultAsync(account =>
                    account.Id == request.SourceBankAccountId.Value
                    && account.UserId == userId
                    && account.IsActive,
                    cancellationToken)
            : null;

        Merchant? merchant = null;
        Beneficiary? beneficiary = null;
        BankAccount? destinationAccount = null;

        if (request.SourceBankAccountId.HasValue && sourceAccount is null)
        {
            return BadRequest(new { message = "Select an active source account that belongs to your profile." });
        }

        if (sourceAccount is null)
        {
            return BadRequest(new { message = "Select an active source account that belongs to your profile." });
        }

        if (!IsSupportedCurrency(sourceAccount.Currency))
        {
            return BadRequest(new { message = $"Currency {sourceAccount.Currency} is not supported by this demo workflow." });
        }

        if (transactionType == "PAYMENT")
        {
            if (!request.MerchantId.HasValue)
            {
                return BadRequest(new { message = "Select a merchant for payment transactions." });
            }

            merchant = await _dbContext.Merchants
                .Include(item => item.SettlementBankAccount)
                .FirstOrDefaultAsync(item => item.Id == request.MerchantId.Value && item.IsActive, cancellationToken);

            if (merchant is null)
            {
                return BadRequest(new { message = "Selected merchant is not available." });
            }

            destinationAccount = merchant.SettlementBankAccount;
        }

        if (transactionType == "TRANSFER")
        {
            if (!request.BeneficiaryId.HasValue)
            {
                return BadRequest(new { message = "Select a saved beneficiary for transfer transactions." });
            }

            beneficiary = await _dbContext.Beneficiaries
                .Include(item => item.Bank)
                .Include(item => item.DestinationBankAccount)
                .FirstOrDefaultAsync(item => item.Id == request.BeneficiaryId.Value && item.UserId == userId, cancellationToken);

            if (beneficiary is null)
            {
                return BadRequest(new { message = "Selected beneficiary is not available." });
            }

            destinationAccount = beneficiary.DestinationBankAccount;
        }

        if (destinationAccount is not null && !string.Equals(sourceAccount.Currency, destinationAccount.Currency, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Source and destination account currencies must match." });
        }

        if (transactionType is "PAYMENT" or "TRANSFER" or "CASH_OUT" or "DEBIT" && sourceAccount.CurrentBalance < request.Amount)
        {
            return BadRequest(new { message = "Source account balance is insufficient for this transaction." });
        }

        var oldOrigin = sourceAccount.CurrentBalance;
        var newOrigin = CalculateNewOriginBalance(oldOrigin, request.Amount, transactionType);
        var oldDestination = destinationAccount?.CurrentBalance ?? 0m;
        var newDestination = CalculateNewDestinationBalance(oldDestination, request.Amount, transactionType, destinationAccount is not null);

        var transaction = new Transaction
        {
            UserId = userId,
            SourceBankAccountId = sourceAccount.Id,
            BeneficiaryId = beneficiary?.Id,
            MerchantId = merchant?.Id,
            Merchant = merchant?.Name ?? beneficiary?.FullName ?? request.Merchant?.Trim() ?? string.Empty,
            Category = merchant?.Category ?? (transactionType == "TRANSFER" ? "Bank Transfer" : request.Category?.Trim() ?? string.Empty),
            Country = merchant?.Country ?? beneficiary?.Bank?.Country ?? request.Country?.Trim() ?? string.Empty,
            Amount = request.Amount,
            OldBalanceOrigin = oldOrigin,
            NewBalanceOrigin = newOrigin,
            OldBalanceDestination = oldDestination,
            NewBalanceDestination = newDestination,
            Currency = sourceAccount.Currency,
            RiskScore = null,
            Status = "pending",
            ProcessingStatus = "PendingAnalysis",
            IdempotencyKey = NormalizeOptional(request.IdempotencyKey),
            TransactionType = transactionType,
            Description = NormalizeOptional(request.Description),
            CreatedAt = DateTime.UtcNow
        };

        if (string.IsNullOrWhiteSpace(transaction.Merchant)
            || string.IsNullOrWhiteSpace(transaction.Category)
            || string.IsNullOrWhiteSpace(transaction.Country))
        {
            return BadRequest(new { message = "Merchant, category, and country are required when no database-backed merchant or beneficiary is selected." });
        }

        var predictionRequest = new CreatePredictionRequest
        {
            TransactionType = transaction.TransactionType,
            Amount = transaction.Amount,
            OldBalanceOrigin = transaction.OldBalanceOrigin,
            NewBalanceOrigin = transaction.NewBalanceOrigin,
            OldBalanceDestination = transaction.OldBalanceDestination,
            NewBalanceDestination = transaction.NewBalanceDestination
        };

        FraudPredictionResult predictionResult;
        try
        {
            predictionResult = await _predictionService.PredictAsync(predictionRequest, cancellationToken);
        }
        catch (FraudPredictionInputException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (FraudPredictionException ex)
        {
            transaction.ProcessingStatus = "Failed";
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }

        var processingStatus = MapProcessingStatus(predictionResult);
        transaction.RiskScore = predictionResult.RiskScore;
        transaction.Status = MapTransactionStatus(processingStatus);
        transaction.ProcessingStatus = processingStatus;

        _dbContext.Transactions.Add(transaction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var prediction = new Prediction
        {
            UserId = transaction.UserId,
            TransactionId = transaction.Id,
            TransactionType = transaction.TransactionType,
            Amount = transaction.Amount,
            OldBalanceOrigin = predictionRequest.OldBalanceOriginValue,
            NewBalanceOrigin = predictionRequest.NewBalanceOriginValue,
            OldBalanceDestination = predictionRequest.OldBalanceDestinationValue,
            NewBalanceDestination = predictionRequest.NewBalanceDestinationValue,
            RiskScore = predictionResult.RiskScore,
            RiskLevel = predictionResult.RiskLevel,
            IsFraud = predictionResult.IsFraud,
            Confidence = predictionResult.Confidence,
            Explanation = JsonSerializer.Serialize(predictionResult.Reasons),
            SuggestedAction = predictionResult.SuggestedAction,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.Predictions.Add(prediction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        FraudAlert? alert = null;
        if (processingStatus == "Completed")
        {
            sourceAccount.CurrentBalance = newOrigin.GetValueOrDefault();
            sourceAccount.UpdatedAt = DateTime.UtcNow;
            if (destinationAccount is not null && newDestination.HasValue)
            {
                destinationAccount.CurrentBalance = newDestination.Value;
                destinationAccount.UpdatedAt = DateTime.UtcNow;
            }

            await _systemLogService.LogAsync("Success", "transaction", $"Transaction TX-{transaction.Id} completed after low-risk ML analysis.", transaction.UserId, null, cancellationToken);
        }
        else if (processingStatus == "PendingReview")
        {
            alert = CreateAlert(transaction, prediction, "Transaction Requires Analyst Review");
            _dbContext.FraudAlerts.Add(alert);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _dbContext.FraudCases.Add(new FraudCase
            {
                TransactionId = transaction.Id,
                PredictionId = prediction.Id,
                FraudAlertId = alert.Id,
                Status = "Open",
                Priority = PriorityForRisk(prediction.RiskScore),
                ModelRiskScore = prediction.RiskScore,
                ModelDecision = prediction.IsFraud ? "Fraud" : "Review",
                CreatedAt = DateTime.UtcNow
            });
            await _systemLogService.LogAsync("Warning", "transaction", $"Transaction TX-{transaction.Id} is pending analyst review.", transaction.UserId, null, cancellationToken);
        }
        else
        {
            alert = CreateAlert(transaction, prediction, "High Risk Transaction Rejected");
            _dbContext.FraudAlerts.Add(alert);
            await _systemLogService.LogAsync("Warning", "transaction", $"Transaction TX-{transaction.Id} rejected by ML analysis before balance updates.", transaction.UserId, null, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var created = await _dbContext.Transactions
            .AsNoTracking()
            .Include(item => item.User)
            .Include(item => item.SourceBankAccount)
            .Include(item => item.Beneficiary)
            .Include(item => item.Predictions)
            .FirstAsync(item => item.Id == transaction.Id, cancellationToken);

        return CreatedAtAction(nameof(GetTransaction), new { id = transaction.Id }, ToResponse(created));
    }

    [Authorize(Roles = ApplicationRoles.AdminOrFraudAnalyst)]
    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<TransactionResponseDto>> UpdateStatus(int id, UpdateTransactionStatusRequestDto request, CancellationToken cancellationToken)
    {
        var status = NormalizeFinalStatus(request.Status);
        if (status is null)
        {
            return BadRequest(new { message = "Status must be safe, review, or fraud." });
        }

        var transaction = await _dbContext.Transactions
            .Include(item => item.User)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound(new { message = "Transaction not found." });
        }

        transaction.Status = status;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "admin", $"Transaction TX-{transaction.Id} status updated to {status}.", transaction.UserId, transaction.User?.FullName, cancellationToken);

        return Ok(ToResponse(transaction));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<TransactionSummaryDto>> Summary(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var query = BuildScopedQuery(userId.Value);
        query = ApplyFilters(query, search, status, fromDate, toDate);

        var totalTransactions = await query.CountAsync(cancellationToken);

        if (totalTransactions == 0)
        {
            return Ok(new TransactionSummaryDto());
        }

        return Ok(new TransactionSummaryDto
        {
            TotalTransactions = totalTransactions,
            PendingCount = await query.CountAsync(transaction => transaction.Status == "pending", cancellationToken),
            SafeCount = await query.CountAsync(transaction => transaction.Status == "safe", cancellationToken),
            ReviewCount = await query.CountAsync(transaction => transaction.Status == "review", cancellationToken),
            FraudCount = await query.CountAsync(transaction => transaction.Status == "fraud", cancellationToken),
            TotalAmount = await query.SumAsync(transaction => transaction.Amount, cancellationToken),
            AverageRisk = await query.AnyAsync(transaction => transaction.RiskScore.HasValue, cancellationToken)
                ? Math.Round(await query.Where(transaction => transaction.RiskScore.HasValue).AverageAsync(transaction => transaction.RiskScore!.Value, cancellationToken), 1)
                : 0
        });
    }

    private IQueryable<Transaction> BuildScopedQuery(int userId)
    {
        var query = _dbContext.Transactions
            .AsNoTracking()
            .Include(transaction => transaction.User)
            .Include(transaction => transaction.SourceBankAccount)
            .Include(transaction => transaction.Beneficiary)
            .Include(transaction => transaction.Predictions)
            .AsQueryable();

        return ApplicationRoles.IsPrivilegedReviewRole(User)
            ? query
            : query.Where(transaction => transaction.UserId == userId);
    }

    private static IQueryable<Transaction> ApplyFilters(IQueryable<Transaction> query, string? search, string? status, DateTime? fromDate, DateTime? toDate)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(transaction =>
                transaction.Merchant.Contains(term)
                || transaction.Category.Contains(term)
                || transaction.Country.Contains(term)
                || transaction.TransactionType.Contains(term)
                || (transaction.User != null && transaction.User.FullName.Contains(term))
                || (transaction.User != null && transaction.User.Email.Contains(term)));
        }

        var normalizedStatus = NormalizeStatus(status);
        if (normalizedStatus is not null)
        {
            query = query.Where(transaction => transaction.Status == normalizedStatus);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(transaction => transaction.CreatedAt >= fromDate.Value.Date);
        }

        if (toDate.HasValue)
        {
            query = query.Where(transaction => transaction.CreatedAt < toDate.Value.Date.AddDays(1));
        }

        return query;
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static TransactionResponseDto ToResponse(Transaction transaction)
    {
        var latestPrediction = transaction.Predictions
            .OrderByDescending(prediction => prediction.CreatedAt)
            .FirstOrDefault();

        return new TransactionResponseDto
        {
            Id = transaction.Id,
            UserId = transaction.UserId,
            UserName = transaction.User?.FullName,
            SourceBankAccountId = transaction.SourceBankAccountId,
            SourceAccount = transaction.SourceBankAccount is null ? null : Mask(transaction.SourceBankAccount.AccountNumber),
            BeneficiaryId = transaction.BeneficiaryId,
            BeneficiaryName = transaction.Beneficiary?.FullName,
            MerchantId = transaction.MerchantId,
            Merchant = transaction.Merchant,
            Category = transaction.Category,
            Country = transaction.Country,
            Amount = transaction.Amount,
            OldBalanceOrigin = transaction.OldBalanceOrigin,
            NewBalanceOrigin = transaction.NewBalanceOrigin,
            OldBalanceDestination = transaction.OldBalanceDestination,
            NewBalanceDestination = transaction.NewBalanceDestination,
            Currency = transaction.Currency,
            RiskScore = transaction.RiskScore,
            Status = transaction.Status,
            ProcessingStatus = transaction.ProcessingStatus,
            TransactionType = transaction.TransactionType,
            CreatedAt = transaction.CreatedAt,
            Description = transaction.Description,
            LatestPredictionId = latestPrediction?.Id,
            LatestPredictionExplanation = latestPrediction is null ? [] : ReadReasons(latestPrediction.Explanation),
            LatestPredictionAt = latestPrediction?.CreatedAt,
            LatestPredictionConfidence = latestPrediction?.Confidence
        };
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

    private static string NormalizeCurrency(string? currency)
    {
        return string.IsNullOrWhiteSpace(currency) ? "USD" : currency.Trim().ToUpperInvariant();
    }

    private static bool IsSupportedCurrency(string currency)
    {
        return NormalizeCurrency(currency) is "EUR" or "USD";
    }

    private bool IsInMemoryDatabase()
    {
        return _dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        var normalized = status.Trim().ToLowerInvariant();
        return FilterStatuses.Contains(normalized) ? normalized : null;
    }

    private static decimal? CalculateNewOriginBalance(decimal? oldBalance, decimal amount, string transactionType)
    {
        if (!oldBalance.HasValue)
        {
            return null;
        }

        return transactionType == "CASH_IN"
            ? oldBalance.Value + amount
            : oldBalance.Value - amount;
    }

    private static decimal? CalculateNewDestinationBalance(decimal oldBalance, decimal amount, string transactionType, bool hasDestinationAccount)
    {
        if (transactionType is "PAYMENT" or "TRANSFER")
        {
            return oldBalance + amount;
        }

        return hasDestinationAccount ? oldBalance : null;
    }

    private static string MapProcessingStatus(FraudPredictionResult result)
    {
        if (result.IsFraud || result.RiskScore >= 70)
        {
            return "Rejected";
        }

        return result.RiskScore >= 40 ? "PendingReview" : "Completed";
    }

    private static string MapTransactionStatus(string processingStatus)
    {
        return processingStatus switch
        {
            "Completed" => "safe",
            "PendingReview" => "review",
            "Rejected" => "fraud",
            _ => "pending"
        };
    }

    private static string PriorityForRisk(int riskScore)
    {
        return riskScore >= 85 ? "Critical" : riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";
    }

    private static FraudAlert CreateAlert(Transaction transaction, Prediction prediction, string title)
    {
        return new FraudAlert
        {
            UserId = transaction.UserId,
            TransactionId = transaction.Id,
            PredictionId = prediction.Id,
            Title = title,
            Severity = prediction.RiskScore >= 85 ? "critical" : "high",
            Status = "open",
            RiskScore = prediction.RiskScore,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static string Mask(string value)
    {
        var trimmed = value.Trim();
        var lastFour = trimmed.Length <= 4 ? trimmed : trimmed[^4..];
        return $"•••• {lastFour}";
    }

    private static string? NormalizeFinalStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        var normalized = status.Trim().ToLowerInvariant();
        return FinalStatuses.Contains(normalized) ? normalized : null;
    }
}
