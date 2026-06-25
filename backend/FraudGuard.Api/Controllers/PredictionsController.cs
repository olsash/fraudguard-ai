using System.IdentityModel.Tokens.Jwt;
using System.Globalization;
using System.Security.Claims;
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
[Authorize]
[Route("api/[controller]")]
public class PredictionsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly PythonPredictionService _predictionService;
    private readonly ISystemLogService _systemLogService;
    private readonly ILogger<PredictionsController> _logger;

    public PredictionsController(
        AppDbContext dbContext,
        PythonPredictionService predictionService,
        ISystemLogService systemLogService,
        ILogger<PredictionsController> logger)
    {
        _dbContext = dbContext;
        _predictionService = predictionService;
        _systemLogService = systemLogService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<PredictionResponse>> Create(CreatePredictionRequest request, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        request.TransactionType = request.TransactionType.Trim().ToUpperInvariant();
        if (!request.HasValidTransactionType())
        {
            return BadRequest(new { message = "Transaction type must be one of CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER." });
        }

        PythonPredictionResult result;
        try
        {
            result = await _predictionService.PredictAsync(request, cancellationToken);
        }
        catch (PredictionServiceUnavailableException ex)
        {
            _logger.LogWarning(ex, "Manual prediction request could not reach the ML prediction service for user {UserId}.", userId.Value);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }

        var prediction = new Prediction
        {
            UserId = userId.Value,
            TransactionType = request.TransactionType,
            Amount = request.AmountValue,
            OldBalanceOrigin = request.OldBalanceOriginValue,
            NewBalanceOrigin = request.NewBalanceOriginValue,
            OldBalanceDestination = request.OldBalanceDestinationValue,
            NewBalanceDestination = request.NewBalanceDestinationValue,
            RiskScore = result.RiskScore,
            RiskLevel = result.RiskLevel,
            IsFraud = result.IsFraud,
            Confidence = result.Confidence,
            Explanation = JsonSerializer.Serialize(result.Reasons),
            SuggestedAction = result.SuggestedAction,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Predictions.Add(prediction);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await CreatePredictionAlertAsync(prediction, result.FraudProbability, cancellationToken);
        await _systemLogService.LogAsync("Success", "prediction", $"Prediction PR-{prediction.Id} created with risk score {prediction.RiskScore}/100.", prediction.UserId, null, cancellationToken);

        return Ok(ToResponse(prediction, result.FraudProbability, result.Confidence, result.Reasons, result));
    }

    [HttpPost("predict-transaction/{transactionId:int}")]
    public async Task<ActionResult<TransactionPredictionResponse>> PredictTransaction(int transactionId, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var transactionQuery = _dbContext.Transactions.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            transactionQuery = transactionQuery.Where(transaction => transaction.UserId == userId.Value);
        }

        var transaction = await transactionQuery.FirstOrDefaultAsync(item => item.Id == transactionId, cancellationToken);
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
        await UpsertAlertAsync(transaction, prediction, cancellationToken);
        await _systemLogService.LogAsync("Success", "prediction", $"Transaction TX-{transaction.Id} analyzed as {transaction.Status} with risk score {prediction.RiskScore}/100.", transaction.UserId, null, cancellationToken);

        return Ok(new TransactionPredictionResponse
        {
            TransactionId = transaction.Id,
            PredictionId = prediction.Id,
            RiskScore = prediction.RiskScore,
            RiskLevel = prediction.RiskLevel,
            Status = transaction.Status,
            Confidence = prediction.Confidence,
            ModelName = result.ModelName,
            ModelTrainingDate = result.ModelTrainingDate,
            PredictedClass = prediction.IsFraud ? "Fraud" : "Not fraud",
            Explanation = result.Reasons,
            CreatedAt = prediction.CreatedAt
        });
    }

    [HttpGet("my")]
    public async Task<ActionResult<IEnumerable<PredictionResponse>>> My(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var predictions = await _dbContext.Predictions
            .AsNoTracking()
            .Include(prediction => prediction.Transaction)
            .Where(prediction => prediction.UserId == userId.Value)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(predictions.Select(ToResponse));
    }

    [HttpGet("my/export")]
    public async Task<IActionResult> ExportMyHistory(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var predictions = await _dbContext.Predictions
            .AsNoTracking()
            .Include(prediction => prediction.Transaction)
            .Where(prediction => prediction.UserId == userId.Value)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return CsvFile(predictions, "prediction-history.csv");
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin")]
    public async Task<ActionResult<IEnumerable<PredictionResponse>>> Admin(CancellationToken cancellationToken)
    {
        var predictions = await _dbContext.Predictions
            .AsNoTracking()
            .Include(prediction => prediction.Transaction)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(predictions.Select(ToResponse));
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin/export")]
    public async Task<IActionResult> ExportAdminHistory(CancellationToken cancellationToken)
    {
        var predictions = await _dbContext.Predictions
            .AsNoTracking()
            .Include(prediction => prediction.Transaction)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return CsvFile(predictions, "admin-prediction-history.csv");
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static PredictionResponse ToResponse(Prediction prediction)
    {
        return ToResponse(prediction, prediction.RiskScore / 100.0, Math.Max(prediction.RiskScore / 100.0, 1 - prediction.RiskScore / 100.0), ReadReasons(prediction.Explanation));
    }

    private static PredictionResponse ToResponse(Prediction prediction, double fraudProbability, double confidence, string[] reasons, PythonPredictionResult? modelResult = null)
    {
        return new PredictionResponse
        {
            Id = prediction.Id,
            UserId = prediction.UserId,
            TransactionId = prediction.TransactionId,
            TransactionMerchant = prediction.Transaction?.Merchant,
            TransactionCountry = prediction.Transaction?.Country,
            TransactionCategory = prediction.Transaction?.Category,
            TransactionCurrency = prediction.Transaction?.Currency,
            TransactionCreatedAt = prediction.Transaction?.CreatedAt,
            TransactionStatus = prediction.Transaction?.Status,
            TransactionType = prediction.TransactionType,
            Amount = prediction.Amount,
            OldBalanceOrigin = prediction.OldBalanceOrigin,
            NewBalanceOrigin = prediction.NewBalanceOrigin,
            OldBalanceDestination = prediction.OldBalanceDestination,
            NewBalanceDestination = prediction.NewBalanceDestination,
            FraudProbability = fraudProbability,
            RiskScore = prediction.RiskScore,
            RiskLevel = prediction.RiskLevel,
            IsFraud = prediction.IsFraud,
            PredictedClass = modelResult?.PredictedClass ?? (prediction.IsFraud ? "Fraud" : "Not fraud"),
            Confidence = prediction.Confidence == 0 ? confidence : prediction.Confidence,
            Reasons = reasons,
            ExplanationFactors = modelResult?.ExplanationFactors.Length > 0 ? modelResult.ExplanationFactors : reasons,
            ModelName = modelResult?.ModelName,
            ModelTrainingDate = modelResult?.ModelTrainingDate,
            SuggestedAction = prediction.SuggestedAction,
            CreatedAt = prediction.CreatedAt
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

    private static FileContentResult CsvFile(IEnumerable<Prediction> predictions, string fileName)
    {
        var csv = BuildPredictionCsv(predictions);
        return new FileContentResult(Encoding.UTF8.GetBytes(csv), "text/csv")
        {
            FileDownloadName = fileName
        };
    }

    private static string BuildPredictionCsv(IEnumerable<Prediction> predictions)
    {
        var builder = new StringBuilder();
        builder.AppendLine("date,transaction_type,amount,prediction_result,risk_score,fraud_probability,explanation_factors");

        foreach (var prediction in predictions)
        {
            var factors = ReadReasons(prediction.Explanation);
            var row = new[]
            {
                prediction.CreatedAt.ToString("O"),
                prediction.TransactionType,
                prediction.Amount.ToString("0.00", CultureInfo.InvariantCulture),
                prediction.IsFraud ? "Fraud" : "Not fraud",
                prediction.RiskScore.ToString(CultureInfo.InvariantCulture),
                (prediction.RiskScore / 100.0).ToString("0.####", CultureInfo.InvariantCulture),
                string.Join(" | ", factors)
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
                mlResult.Confidence,
                mlResult.ModelName,
                mlResult.ModelTrainingDate);
        }
        catch (PredictionServiceUnavailableException)
        {
            _logger.LogWarning("ML prediction service unavailable while scoring transaction TX-{TransactionId}; using rule-based fallback.", transaction.Id);
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
            riskFactors.Add("Amount exceeds the high-risk threshold of $3,000.");
        }
        else if (transaction.Amount > 1000)
        {
            score += 20;
            riskFactors.Add("Transaction amount is higher than average.");
        }
        else
        {
            protectiveFactors.Add("Transaction amount is within the normal range.");
        }

        if (elevatedCountry)
        {
            score += 25;
            riskFactors.Add("Country is on the elevated-risk list.");
        }
        else
        {
            protectiveFactors.Add("Country is considered low risk.");
        }

        if (elevatedCategory)
        {
            score += 20;
            riskFactors.Add("Transaction category is frequently associated with fraud.");
        }
        else
        {
            protectiveFactors.Add("Transaction category is commonly associated with legitimate activity.");
        }

        if (suspiciousMerchant)
        {
            score += 20;
            riskFactors.Add("Merchant has suspicious activity indicators.");
        }
        else
        {
            protectiveFactors.Add("Merchant has no known fraud indicators.");
        }

        if (elevatedTransactionType)
        {
            score += 10;
            riskFactors.Add("Transaction type has higher fraud exposure.");
        }
        else
        {
            protectiveFactors.Add("Transaction type is consistent with routine payment activity.");
        }

        var hour = transaction.CreatedAt.ToUniversalTime().Hour;
        if (hour is >= 0 and <= 5)
        {
            score += 8;
            riskFactors.Add("Transaction occurred during night-time hours.");
        }

        score = Math.Clamp(score, 0, 100);
        var status = MapStatus(score);
        var riskLevel = MapRiskLevel(score);

        if (riskFactors.Count == 0)
        {
            protectiveFactors.Add("No unusual transaction patterns were detected.");
        }

        if (riskFactors.Count >= 2)
        {
            riskFactors.Add("Multiple fraud rules were triggered.");
        }

        if (status == "fraud")
        {
            riskFactors.Add("Final risk exceeded the fraud threshold.");
        }
        else if (status == "review")
        {
            riskFactors.Add("Final risk exceeded the review threshold.");
        }
        else
        {
            protectiveFactors.Add("Final risk remained below the fraud threshold.");
        }

        return new TransactionRiskResult(
            score,
            riskLevel,
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

    private async Task UpsertAlertAsync(Transaction transaction, Prediction prediction, CancellationToken cancellationToken)
    {
        if (transaction.Status != "fraud" && !prediction.IsFraud && prediction.RiskScore < 70)
        {
            return;
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
            await _systemLogService.LogAsync("Warning", "alert", $"Alert generated for transaction TX-{transaction.Id}.", transaction.UserId, null, cancellationToken);
        }
        else
        {
            alert.PredictionId = prediction.Id;
            alert.Title = "High Risk Fraud Prediction";
            alert.Severity = prediction.RiskScore >= 85 ? "critical" : "high";
            alert.RiskScore = prediction.RiskScore;
            await _systemLogService.LogAsync("Info", "alert", $"Alert updated for transaction TX-{transaction.Id}.", transaction.UserId, null, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task CreatePredictionAlertAsync(Prediction prediction, double fraudProbability, CancellationToken cancellationToken)
    {
        if (prediction.TransactionId.HasValue || (!prediction.IsFraud && prediction.RiskScore < 70))
        {
            return;
        }

        var existingAlert = await _dbContext.FraudAlerts
            .FirstOrDefaultAsync(alert => alert.PredictionId == prediction.Id && alert.Status != "resolved", cancellationToken);

        if (existingAlert is not null)
        {
            existingAlert.RiskScore = prediction.RiskScore;
            existingAlert.Severity = prediction.RiskScore >= 85 || fraudProbability >= 0.85 ? "critical" : "high";
            await _dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        _dbContext.FraudAlerts.Add(new FraudAlert
        {
            UserId = prediction.UserId,
            PredictionId = prediction.Id,
            Title = "High Risk Fraud Prediction",
            Severity = prediction.RiskScore >= 85 || fraudProbability >= 0.85 ? "critical" : "high",
            Status = "open",
            RiskScore = prediction.RiskScore,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Warning", "alert", $"Alert generated for prediction PR-{prediction.Id}.", prediction.UserId, null, cancellationToken);
    }

    private static string NormalizeTransactionType(string transactionType)
    {
        var normalized = transactionType.Trim().ToUpperInvariant().Replace(" ", "_");
        return normalized is "CASH_IN" or "CASH_OUT" or "DEBIT" or "PAYMENT" or "TRANSFER"
            ? normalized
            : "PAYMENT";
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

    private sealed record TransactionRiskResult(int RiskScore, string RiskLevel, string Status, string[] Reasons, string SuggestedAction, double Confidence, string? ModelName = null, string? ModelTrainingDate = null);
}
