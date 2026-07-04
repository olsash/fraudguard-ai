using System.Globalization;
using System.Text;
using System.Text.Json;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IFraudPredictionService _predictionService;
    private readonly ISystemLogService _systemLogService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        AppDbContext dbContext,
        IFraudPredictionService predictionService,
        ISystemLogService systemLogService,
        ILogger<AdminController> logger)
    {
        _dbContext = dbContext;
        _predictionService = predictionService;
        _systemLogService = systemLogService;
        _logger = logger;
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<AdminPagedResultDto<AdminTransactionDto>>> GetTransactions(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? riskLevel = null,
        [FromQuery] string? transactionType = null,
        [FromQuery] decimal? minAmount = null,
        [FromQuery] decimal? maxAmount = null,
        [FromQuery] string? fraudStatus = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);

        var query = ApplyTransactionFilters(BuildTransactionQuery(), search, status, riskLevel, transactionType, minAmount, maxAmount, fraudStatus, fromDate, toDate);
        var totalCount = await query.CountAsync(cancellationToken);
        var transactions = await ApplyTransactionSorting(query, sortBy, sortDirection)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Ok(new AdminPagedResultDto<AdminTransactionDto>
        {
            Items = transactions.Select(ToTransactionDto),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [HttpGet("transactions/{id:int}")]
    public async Task<ActionResult<AdminTransactionDetailDto>> GetTransaction(int id, CancellationToken cancellationToken)
    {
        var transaction = await BuildTransactionQuery()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound(new { message = "Transaction not found." });
        }

        var alert = await LoadAlertForTransaction(transaction.Id, cancellationToken);
        return Ok(ToTransactionDetailDto(transaction, alert));
    }

    [HttpPost("transactions/{id:int}/analyze")]
    public async Task<ActionResult<AdminTransactionAnalysisDto>> AnalyzeTransaction(int id, CancellationToken cancellationToken)
    {
        var transaction = await _dbContext.Transactions
            .Include(item => item.User)
            .Include(item => item.Predictions)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (transaction is null)
        {
            return NotFound(new { message = "Transaction not found." });
        }

        var result = await ScoreTransactionAsync(transaction, cancellationToken);
        var prediction = new Prediction
        {
            UserId = transaction.UserId,
            TransactionId = transaction.Id,
            TransactionType = transaction.TransactionType,
            Amount = transaction.Amount,
            OldBalanceOrigin = 0,
            NewBalanceOrigin = 0,
            OldBalanceDestination = 0,
            NewBalanceDestination = 0,
            RiskScore = result.RiskScore,
            RiskLevel = result.RiskLevel,
            IsFraud = result.Status == "fraud",
            Confidence = result.Confidence,
            Explanation = JsonSerializer.Serialize(result.Reasons),
            SuggestedAction = result.SuggestedAction,
            CreatedAt = DateTime.UtcNow
        };

        transaction.RiskScore = result.RiskScore;
        transaction.Status = result.Status;
        _dbContext.Predictions.Add(prediction);

        await _dbContext.SaveChangesAsync(cancellationToken);
        var alertCreated = await UpsertAlertAsync(transaction, prediction, cancellationToken);
        await _systemLogService.LogAsync("Success", "admin", $"Admin analysis completed for transaction TX-{transaction.Id}; status is {transaction.Status}.", transaction.UserId, transaction.User?.FullName, cancellationToken);

        var reloaded = await BuildTransactionQuery()
            .FirstAsync(item => item.Id == transaction.Id, cancellationToken);
        var alert = await LoadAlertForTransaction(transaction.Id, cancellationToken);
        var predictionDetail = await BuildPredictionQuery()
            .FirstAsync(item => item.Id == prediction.Id, cancellationToken);

        return Ok(new AdminTransactionAnalysisDto
        {
            Transaction = ToTransactionDetailDto(reloaded, alert),
            Prediction = ToPredictionDetailDto(predictionDetail, alert),
            AlertCreated = alertCreated
        });
    }

    [HttpGet("predictions")]
    public async Task<ActionResult<IEnumerable<AdminPredictionDto>>> GetPredictions(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? riskLevel,
        [FromQuery] string? predictionResult,
        [FromQuery] string? transactionType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int? userId,
        CancellationToken cancellationToken)
    {
        var predictions = await ApplyPredictionFilters(BuildPredictionQuery(), search, status, riskLevel, predictionResult, transactionType, fromDate, toDate, userId)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(predictions.Select(ToPredictionDto));
    }

    [HttpGet("predictions/export")]
    public async Task<IActionResult> ExportPredictions(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? riskLevel,
        [FromQuery] string? predictionResult,
        [FromQuery] string? transactionType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int? userId,
        CancellationToken cancellationToken)
    {
        var predictions = await ApplyPredictionFilters(BuildPredictionQuery(), search, status, riskLevel, predictionResult, transactionType, fromDate, toDate, userId)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return File(
            Encoding.UTF8.GetBytes(BuildPredictionCsv(predictions)),
            "text/csv",
            "admin-prediction-history.csv");
    }

    [HttpGet("predictions/{id:int}")]
    public async Task<ActionResult<AdminPredictionDetailDto>> GetPrediction(int id, CancellationToken cancellationToken)
    {
        var prediction = await BuildPredictionQuery()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (prediction is null)
        {
            return NotFound(new { message = "Prediction not found." });
        }

        var alert = await LoadAlertForPrediction(prediction.Id, prediction.TransactionId, cancellationToken);
        return Ok(ToPredictionDetailDto(prediction, alert));
    }

    private IQueryable<Transaction> BuildTransactionQuery()
    {
        return _dbContext.Transactions
            .AsNoTracking()
            .Include(transaction => transaction.User)
            .Include(transaction => transaction.Predictions)
            .AsQueryable();
    }

    private IQueryable<Prediction> BuildPredictionQuery()
    {
        return _dbContext.Predictions
            .AsNoTracking()
            .Include(prediction => prediction.User)
            .Include(prediction => prediction.Transaction)
            .AsQueryable();
    }

    private static IQueryable<Transaction> ApplyTransactionFilters(
        IQueryable<Transaction> query,
        string? search,
        string? status,
        string? riskLevel,
        string? transactionType,
        decimal? minAmount,
        decimal? maxAmount,
        string? fraudStatus,
        DateTime? fromDate,
        DateTime? toDate)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var numericSearch = int.TryParse(term.TrimStart('T', 'X', 'P', 'R', '-', '#'), out var searchedId);
            query = query.Where(transaction =>
                transaction.Merchant.Contains(term)
                || transaction.Country.Contains(term)
                || transaction.Category.Contains(term)
                || transaction.TransactionType.Contains(term)
                || (numericSearch && (transaction.Id == searchedId || transaction.UserId == searchedId))
                || (transaction.User != null && transaction.User.FullName.Contains(term))
                || (transaction.User != null && transaction.User.Email.Contains(term)));
        }

        var normalizedStatus = NormalizeStatus(status);
        if (normalizedStatus is not null)
        {
            query = query.Where(transaction => transaction.Status == normalizedStatus);
        }

        var normalizedFraudStatus = fraudStatus?.Trim().ToLowerInvariant();
        if (normalizedFraudStatus == "fraud")
        {
            query = query.Where(transaction => transaction.Status == "fraud");
        }
        else if (normalizedFraudStatus is "not_fraud" or "not-fraud" or "notfraud")
        {
            query = query.Where(transaction => transaction.Status != "fraud");
        }

        query = ApplyRiskFilter(query, riskLevel);

        var normalizedTransactionType = NormalizeTransactionTypeFilter(transactionType);
        if (normalizedTransactionType is not null)
        {
            query = query.Where(transaction => transaction.TransactionType == normalizedTransactionType);
        }

        if (minAmount.HasValue)
        {
            query = query.Where(transaction => transaction.Amount >= minAmount.Value);
        }

        if (maxAmount.HasValue)
        {
            query = query.Where(transaction => transaction.Amount <= maxAmount.Value);
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

    private static IQueryable<Transaction> ApplyTransactionSorting(IQueryable<Transaction> query, string? sortBy, string? sortDirection)
    {
        var descending = !string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "amount" => descending ? query.OrderByDescending(transaction => transaction.Amount) : query.OrderBy(transaction => transaction.Amount),
            "riskscore" or "risk_score" or "risk" => descending
                ? query.OrderByDescending(transaction => transaction.RiskScore ?? -1)
                : query.OrderBy(transaction => transaction.RiskScore ?? -1),
            "date" or "createdat" or "created_at" => descending
                ? query.OrderByDescending(transaction => transaction.CreatedAt)
                : query.OrderBy(transaction => transaction.CreatedAt),
            _ => query.OrderByDescending(transaction => transaction.CreatedAt)
        };
    }

    private static IQueryable<Prediction> ApplyPredictionFilters(
        IQueryable<Prediction> query,
        string? search,
        string? status,
        string? riskLevel,
        string? predictionResult,
        string? transactionType,
        DateTime? fromDate,
        DateTime? toDate,
        int? userId)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var numericSearch = int.TryParse(term.TrimStart('T', 'X', 'P', 'R', '-', '#'), out var searchedId);
            query = query.Where(prediction =>
                prediction.TransactionType.Contains(term)
                || (numericSearch && (prediction.Id == searchedId || prediction.TransactionId == searchedId || prediction.UserId == searchedId))
                || (prediction.Transaction != null && prediction.Transaction.Merchant.Contains(term))
                || (prediction.Transaction != null && prediction.Transaction.Country.Contains(term))
                || (prediction.Transaction != null && prediction.Transaction.Category.Contains(term))
                || (prediction.User != null && prediction.User.FullName.Contains(term))
                || (prediction.User != null && prediction.User.Email.Contains(term)));
        }

        var normalizedStatus = NormalizeStatus(status);
        if (normalizedStatus is not null)
        {
            query = query.Where(prediction =>
                prediction.Transaction != null
                    ? prediction.Transaction.Status == normalizedStatus
                    : MapStatus(prediction.RiskScore) == normalizedStatus);
        }

        var normalizedRisk = NormalizeRiskLevel(riskLevel);
        if (normalizedRisk == "low")
        {
            query = query.Where(prediction => prediction.RiskScore < 40);
        }
        else if (normalizedRisk == "medium")
        {
            query = query.Where(prediction => prediction.RiskScore >= 40 && prediction.RiskScore < 70);
        }
        else if (normalizedRisk == "high")
        {
            query = query.Where(prediction => prediction.RiskScore >= 70);
        }

        var normalizedPredictionResult = predictionResult?.Trim().ToLowerInvariant();
        if (normalizedPredictionResult == "fraud")
        {
            query = query.Where(prediction => prediction.IsFraud);
        }
        else if (normalizedPredictionResult is "not_fraud" or "not-fraud" or "notfraud")
        {
            query = query.Where(prediction => !prediction.IsFraud);
        }

        var normalizedTransactionType = NormalizeTransactionTypeFilter(transactionType);
        if (normalizedTransactionType is not null)
        {
            query = query.Where(prediction => prediction.TransactionType == normalizedTransactionType);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(prediction => prediction.CreatedAt >= fromDate.Value.Date);
        }

        if (toDate.HasValue)
        {
            query = query.Where(prediction => prediction.CreatedAt < toDate.Value.Date.AddDays(1));
        }

        if (userId.HasValue)
        {
            query = query.Where(prediction => prediction.UserId == userId.Value);
        }

        return query;
    }

    private static IQueryable<Transaction> ApplyRiskFilter(IQueryable<Transaction> query, string? riskLevel)
    {
        var normalizedRisk = NormalizeRiskLevel(riskLevel);
        if (normalizedRisk == "low")
        {
            return query.Where(transaction => transaction.RiskScore.HasValue && transaction.RiskScore.Value < 40);
        }

        if (normalizedRisk == "medium")
        {
            return query.Where(transaction => transaction.RiskScore.HasValue && transaction.RiskScore.Value >= 40 && transaction.RiskScore.Value < 70);
        }

        return normalizedRisk == "high"
            ? query.Where(transaction => transaction.RiskScore.HasValue && transaction.RiskScore.Value >= 70)
            : query;
    }

    private async Task<FraudAlert?> LoadAlertForTransaction(int transactionId, CancellationToken cancellationToken)
    {
        return await _dbContext.FraudAlerts
            .AsNoTracking()
            .OrderByDescending(alert => alert.CreatedAt)
            .FirstOrDefaultAsync(alert => alert.TransactionId == transactionId, cancellationToken);
    }

    private async Task<FraudAlert?> LoadAlertForPrediction(int predictionId, int? transactionId, CancellationToken cancellationToken)
    {
        return await _dbContext.FraudAlerts
            .AsNoTracking()
            .OrderByDescending(alert => alert.CreatedAt)
            .FirstOrDefaultAsync(alert =>
                alert.PredictionId == predictionId
                || (transactionId.HasValue && alert.TransactionId == transactionId.Value), cancellationToken);
    }

    private static AdminTransactionDto ToTransactionDto(Transaction transaction)
    {
        var latestPrediction = GetLatestPrediction(transaction);
        return new AdminTransactionDto
        {
            Id = transaction.Id,
            UserId = transaction.UserId,
            UserName = transaction.User?.FullName ?? $"User {transaction.UserId}",
            UserEmail = transaction.User?.Email,
            Merchant = transaction.Merchant,
            Country = transaction.Country,
            Category = transaction.Category,
            Amount = transaction.Amount,
            Currency = transaction.Currency,
            TransactionType = transaction.TransactionType,
            RiskScore = transaction.RiskScore,
            Status = transaction.Status,
            CreatedAt = transaction.CreatedAt,
            PredictionId = latestPrediction?.Id
        };
    }

    private static AdminTransactionDetailDto ToTransactionDetailDto(Transaction transaction, FraudAlert? alert)
    {
        var latestPrediction = GetLatestPrediction(transaction);
        return new AdminTransactionDetailDto
        {
            Id = transaction.Id,
            UserId = transaction.UserId,
            UserName = transaction.User?.FullName ?? $"User {transaction.UserId}",
            UserEmail = transaction.User?.Email,
            Merchant = transaction.Merchant,
            Country = transaction.Country,
            Category = transaction.Category,
            Amount = transaction.Amount,
            Currency = transaction.Currency,
            TransactionType = transaction.TransactionType,
            RiskScore = transaction.RiskScore,
            Status = transaction.Status,
            CreatedAt = transaction.CreatedAt,
            PredictionId = latestPrediction?.Id,
            Description = transaction.Description,
            Prediction = latestPrediction is null ? null : ToPredictionSummaryDto(latestPrediction),
            Alert = alert is null ? null : ToAlertSummaryDto(alert)
        };
    }

    private static AdminPredictionDto ToPredictionDto(Prediction prediction)
    {
        return new AdminPredictionDto
        {
            Id = prediction.Id,
            TransactionId = prediction.TransactionId,
            TransactionMerchant = prediction.Transaction?.Merchant ?? $"TX-{prediction.TransactionId}",
            UserId = prediction.UserId,
            UserName = prediction.User?.FullName ?? $"User {prediction.UserId}",
            UserEmail = prediction.User?.Email,
            Country = prediction.Transaction?.Country ?? "-",
            Category = prediction.Transaction?.Category ?? "-",
            Amount = prediction.Amount,
            Currency = prediction.Transaction?.Currency ?? "USD",
            TransactionType = prediction.TransactionType,
            RiskScore = prediction.RiskScore,
            RiskLevel = prediction.RiskLevel,
            Status = prediction.Transaction?.Status ?? MapStatus(prediction.RiskScore),
            CreatedAt = prediction.CreatedAt,
            Factors = ReadReasons(prediction.Explanation)
        };
    }

    private static AdminPredictionDetailDto ToPredictionDetailDto(Prediction prediction, FraudAlert? alert)
    {
        var dto = new AdminPredictionDetailDto
        {
            Id = prediction.Id,
            TransactionId = prediction.TransactionId,
            TransactionMerchant = prediction.Transaction?.Merchant ?? $"TX-{prediction.TransactionId}",
            UserId = prediction.UserId,
            UserName = prediction.User?.FullName ?? $"User {prediction.UserId}",
            UserEmail = prediction.User?.Email,
            Country = prediction.Transaction?.Country ?? "-",
            Category = prediction.Transaction?.Category ?? "-",
            Amount = prediction.Amount,
            Currency = prediction.Transaction?.Currency ?? "USD",
            TransactionType = prediction.TransactionType,
            RiskScore = prediction.RiskScore,
            RiskLevel = prediction.RiskLevel,
            Status = prediction.Transaction?.Status ?? MapStatus(prediction.RiskScore),
            CreatedAt = prediction.CreatedAt,
            Factors = ReadReasons(prediction.Explanation),
            SuggestedAction = prediction.SuggestedAction,
            Confidence = prediction.Confidence,
            User = new AdminUserInfoDto
            {
                Id = prediction.UserId,
                Name = prediction.User?.FullName ?? $"User {prediction.UserId}",
                Email = prediction.User?.Email
            },
            Alert = alert is null ? null : ToAlertSummaryDto(alert)
        };

        if (prediction.Transaction is not null)
        {
            dto.Transaction = new AdminTransactionInfoDto
            {
                Id = prediction.Transaction.Id,
                Merchant = prediction.Transaction.Merchant,
                Country = prediction.Transaction.Country,
                Category = prediction.Transaction.Category,
                Amount = prediction.Transaction.Amount,
                Currency = prediction.Transaction.Currency,
                TransactionType = prediction.Transaction.TransactionType,
                CreatedAt = prediction.Transaction.CreatedAt
            };
        }

        dto.DecisionSummary = BuildDecisionSummary(dto);
        return dto;
    }

    private static AdminPredictionSummaryDto ToPredictionSummaryDto(Prediction prediction)
    {
        return new AdminPredictionSummaryDto
        {
            Id = prediction.Id,
            RiskScore = prediction.RiskScore,
            RiskLevel = prediction.RiskLevel,
            Status = prediction.Transaction?.Status ?? MapStatus(prediction.RiskScore),
            Factors = ReadReasons(prediction.Explanation),
            SuggestedAction = prediction.SuggestedAction,
            Confidence = prediction.Confidence,
            CreatedAt = prediction.CreatedAt
        };
    }

    private static AdminAlertSummaryDto ToAlertSummaryDto(FraudAlert alert)
    {
        return new AdminAlertSummaryDto
        {
            Id = alert.Id,
            Severity = alert.Severity,
            Status = alert.Status,
            CreatedAt = alert.CreatedAt
        };
    }

    private static Prediction? GetLatestPrediction(Transaction transaction)
    {
        return transaction.Predictions
            .OrderByDescending(prediction => prediction.CreatedAt)
            .FirstOrDefault();
    }

    private async Task<TransactionRiskResult> ScoreTransactionAsync(Transaction transaction, CancellationToken cancellationToken)
    {
        var ruleResult = ScoreTransaction(transaction);
        var mlRequest = new CreatePredictionRequest
        {
            TransactionType = NormalizeTransactionType(transaction.TransactionType),
            Amount = transaction.Amount,
            OldBalanceOrigin = transaction.Amount,
            NewBalanceOrigin = 0,
            OldBalanceDestination = 0,
            NewBalanceDestination = transaction.Amount
        };

        try
        {
            var mlResult = await _predictionService.PredictAsync(mlRequest, cancellationToken);
            var riskScore = Math.Clamp(Math.Max(mlResult.RiskScore, ruleResult.RiskScore), 0, 100);
            var modelReasons = mlResult.Reasons
                .Where(reason => !string.IsNullOrWhiteSpace(reason));

            var reasons = ruleResult.Reasons
                .Concat(modelReasons)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return new TransactionRiskResult(
                riskScore,
                MapRiskLevel(riskScore),
                MapStatus(riskScore),
                reasons.Length == 0 ? ruleResult.Reasons : reasons,
                SuggestedActionForScore(riskScore),
                mlResult.Confidence);
        }
        catch (FraudPredictionException)
        {
            _logger.LogWarning("ONNX prediction service unavailable during admin analysis for transaction TX-{TransactionId}; using rule-based fallback.", transaction.Id);
            return ruleResult;
        }
    }

    private static TransactionRiskResult ScoreTransaction(Transaction transaction)
    {
        var score = 0;
        var riskFactors = new List<string>();
        var protectiveFactors = new List<string>();
        var merchant = transaction.Merchant.Trim().ToLowerInvariant();
        var elevatedCountry = new[] { "Nigeria", "Russia", "North Korea", "Iran" }.Contains(transaction.Country, StringComparer.OrdinalIgnoreCase);
        var elevatedCategory = new[] { "Money Transfer", "Crypto", "Gambling" }.Contains(transaction.Category, StringComparer.OrdinalIgnoreCase);
        var suspiciousMerchant = string.IsNullOrWhiteSpace(transaction.Merchant)
            || new[] { "unknown", "quickcash", "crypto", "wire", "giftcard", "offshore" }.Any(item => merchant.Contains(item, StringComparison.OrdinalIgnoreCase));
        var elevatedTransactionType = transaction.TransactionType.Equals("TRANSFER", StringComparison.OrdinalIgnoreCase)
            || transaction.TransactionType.Equals("CASH_OUT", StringComparison.OrdinalIgnoreCase);

        if (transaction.Amount > 3000)
        {
            score += 35;
            riskFactors.Add("High transaction amount");
        }
        else if (transaction.Amount > 1000)
        {
            score += 20;
            riskFactors.Add("Medium transaction amount");
        }
        else
        {
            protectiveFactors.Add("Amount is within normal range");
        }

        if (elevatedCountry)
        {
            score += 25;
            riskFactors.Add("High-risk country");
        }
        else
        {
            protectiveFactors.Add("Country is considered low risk");
        }

        if (elevatedCategory)
        {
            score += 20;
            riskFactors.Add("Country/category requires review");
        }
        else
        {
            protectiveFactors.Add("Transaction type is common");
        }

        if (suspiciousMerchant)
        {
            score += 20;
            riskFactors.Add("Suspicious merchant pattern detected");
        }
        else
        {
            protectiveFactors.Add("No suspicious pattern detected");
        }

        if (elevatedTransactionType)
        {
            score += 10;
            riskFactors.Add("Suspicious transaction type");
        }

        var hour = transaction.CreatedAt.ToUniversalTime().Hour;
        if (hour is >= 0 and <= 5)
        {
            score += 8;
            riskFactors.Add("Transaction occurred during night-time hours");
        }

        score = Math.Clamp(score, 0, 100);
        var status = MapStatus(score);

        if (riskFactors.Count == 0)
        {
            protectiveFactors.Add("No suspicious pattern detected");
        }

        if (riskFactors.Count >= 2)
        {
            riskFactors.Add("Multiple risk signals detected");
        }

        if (status == "fraud")
        {
            riskFactors.Add("Risk score exceeded fraud threshold");
        }
        else if (status == "review")
        {
            riskFactors.Add("Some risk signals detected");
        }

        return new TransactionRiskResult(
            score,
            MapRiskLevel(score),
            status,
            BuildDerivedPredictionFactors(transaction).Concat(BuildReasonSections(riskFactors, protectiveFactors)).ToArray(),
            SuggestedActionForScore(score),
            score >= 70 ? 0.92 : score >= 40 ? 0.78 : 0.72);
    }

    private static string[] BuildDerivedPredictionFactors(Transaction transaction)
    {
        var normalizedType = NormalizeTransactionType(transaction.TransactionType);
        var originDelta = transaction.Amount;
        var destinationDelta = transaction.Amount;
        var factors = new List<string>
        {
            $"Input Values|Transaction amount is {transaction.Amount:N2}.",
            $"Input Values|Transaction type is {normalizedType}.",
            $"Balance Movement|Saved transaction analysis uses derived origin balances: {transaction.Amount:N2} to 0.00, a decrease of {originDelta:N2}.",
            $"Balance Movement|Saved transaction analysis uses derived destination balances: 0.00 to {transaction.Amount:N2}, an increase of {destinationDelta:N2}.",
            "Risk Factors|Derived destination account starts with a zero balance for the ML transaction analysis."
        };

        if ((normalizedType == "TRANSFER" || normalizedType == "CASH_OUT") && transaction.Amount > 100000)
        {
            factors.Add($"Risk Factors|High amount transaction uses a fraud-sensitive type ({normalizedType}).");
        }
        else if (normalizedType == "TRANSFER" || normalizedType == "CASH_OUT")
        {
            factors.Add($"Risk Factors|Transaction type {normalizedType} has elevated fraud exposure.");
        }
        else
        {
            factors.Add($"Protective Factors|Transaction type {normalizedType} is lower risk in this rule set.");
        }

        factors.Add("Protective Factors|Derived origin balance movement is consistent with the transaction amount.");
        factors.Add("Protective Factors|Derived destination balance movement is consistent with an incoming transfer.");

        return factors.ToArray();
    }

    private async Task<bool> UpsertAlertAsync(Transaction transaction, Prediction prediction, CancellationToken cancellationToken)
    {
        if (transaction.Status != "fraud" && !prediction.IsFraud && prediction.RiskScore < 70)
        {
            return false;
        }

        var alert = await _dbContext.FraudAlerts
            .FirstOrDefaultAsync(item => item.TransactionId == transaction.Id && item.Status != "resolved", cancellationToken);

        if (alert is null)
        {
            _dbContext.FraudAlerts.Add(new FraudAlert
            {
                UserId = transaction.UserId,
                TransactionId = transaction.Id,
                PredictionId = prediction.Id,
                Title = "High Risk Fraud Prediction",
                Severity = prediction.RiskScore >= 85 ? "critical" : "high",
                Status = "open",
                RiskScore = prediction.RiskScore,
                CreatedAt = DateTime.UtcNow
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _systemLogService.LogAsync("Warning", "alert", $"Alert generated for transaction TX-{transaction.Id} by admin analysis.", transaction.UserId, transaction.User?.FullName, cancellationToken);
            return true;
        }

        alert.PredictionId = prediction.Id;
        alert.Title = "High Risk Fraud Prediction";
        alert.Severity = prediction.RiskScore >= 85 ? "critical" : "high";
        alert.RiskScore = prediction.RiskScore;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Info", "alert", $"Alert updated for transaction TX-{transaction.Id} by admin analysis.", transaction.UserId, transaction.User?.FullName, cancellationToken);
        return false;
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

    private static string BuildPredictionCsv(IEnumerable<Prediction> predictions)
    {
        var builder = new StringBuilder();
        builder.AppendLine("date,user,transaction_type,amount,prediction_result,risk_score,fraud_probability,explanation_factors");

        foreach (var prediction in predictions)
        {
            var row = new[]
            {
                prediction.CreatedAt.ToString("O"),
                prediction.User?.FullName ?? $"User {prediction.UserId}",
                prediction.TransactionType,
                prediction.Amount.ToString("0.00", CultureInfo.InvariantCulture),
                prediction.IsFraud ? "Fraud" : "Not fraud",
                prediction.RiskScore.ToString(CultureInfo.InvariantCulture),
                (prediction.RiskScore / 100.0).ToString("0.####", CultureInfo.InvariantCulture),
                string.Join(" | ", ReadReasons(prediction.Explanation))
            };

            builder.AppendLine(string.Join(",", row.Select(EscapeCsv)));
        }

        return builder.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private static string BuildDecisionSummary(AdminPredictionDto prediction)
    {
        var status = prediction.Status.ToUpperInvariant();
        return $"This transaction was classified as {status} because the risk score reached {prediction.RiskScore}/100 and {DecisionSignalText(prediction.RiskScore)}.";
    }

    private static string DecisionSignalText(int riskScore)
    {
        return riskScore >= 70
            ? "multiple suspicious indicators were detected"
            : riskScore >= 40
                ? "some risk signals were detected"
                : "no suspicious pattern was detected";
    }

    private static string NormalizeTransactionType(string transactionType)
    {
        var normalized = transactionType.Trim().ToUpperInvariant().Replace(" ", "_");
        return normalized is "CASH_IN" or "CASH_OUT" or "DEBIT" or "PAYMENT" or "TRANSFER"
            ? normalized
            : "PAYMENT";
    }

    private static string? NormalizeTransactionTypeFilter(string? transactionType)
    {
        if (string.IsNullOrWhiteSpace(transactionType) || transactionType.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var normalized = transactionType.Trim().ToUpperInvariant().Replace(" ", "_");
        return normalized is "CASH_IN" or "CASH_OUT" or "DEBIT" or "PAYMENT" or "TRANSFER"
            ? normalized
            : null;
    }

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) || status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var normalized = status.Trim().ToLowerInvariant();
        return normalized is "pending" or "safe" or "review" or "fraud" ? normalized : null;
    }

    private static string? NormalizeRiskLevel(string? riskLevel)
    {
        if (string.IsNullOrWhiteSpace(riskLevel) || riskLevel.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var normalized = riskLevel.Trim().ToLowerInvariant();
        return normalized is "low" or "medium" or "review" or "high" or "fraud"
            ? normalized is "review" ? "medium" : normalized is "fraud" ? "high" : normalized
            : null;
    }

    private static string MapStatus(int riskScore)
    {
        return riskScore >= 70 ? "fraud" : riskScore >= 40 ? "review" : "safe";
    }

    private static string MapRiskLevel(int riskScore)
    {
        return riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";
    }

    private static string SuggestedActionForScore(int riskScore)
    {
        return riskScore >= 70 ? "Block transaction immediately" : riskScore >= 40 ? "Manual verification recommended" : "Approve transaction";
    }

    private static string[] BuildReasonSections(List<string> riskFactors, List<string> protectiveFactors)
    {
        return riskFactors
            .Select(reason => $"Risk Factors|{reason}")
            .Concat(protectiveFactors.Select(reason => $"Protective Factors|{reason}"))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private sealed record TransactionRiskResult(int RiskScore, string RiskLevel, string Status, string[] Reasons, string SuggestedAction, double Confidence);
}
