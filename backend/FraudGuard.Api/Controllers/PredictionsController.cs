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
    private readonly IFraudPredictionService _predictionService;
    private readonly ISystemLogService _systemLogService;
    private readonly ILogger<PredictionsController> _logger;

    public PredictionsController(
        AppDbContext dbContext,
        IFraudPredictionService predictionService,
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

        FraudPredictionResult result;
        try
        {
            result = await _predictionService.PredictAsync(request, cancellationToken);
        }
        catch (FraudPredictionInputException ex)
        {
            _logger.LogWarning(ex, "Manual prediction request has invalid model input for user {UserId}.", userId.Value);
            return BadRequest(new { message = ex.Message });
        }
        catch (FraudPredictionException ex)
        {
            _logger.LogWarning(ex, "Manual prediction request failed in the ONNX prediction service for user {UserId}.", userId.Value);
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
    public async Task<ActionResult<TransactionPredictionResponse>> PredictTransaction(
        int transactionId,
        AnalyzeTransactionRequest? request,
        CancellationToken cancellationToken)
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

        var balances = ResolveBalances(transaction, request);
        var balanceErrors = ValidateBalances(balances);
        if (balanceErrors.Length > 0)
        {
            return BadRequest(new { message = balanceErrors[0], errors = balanceErrors });
        }

        var predictionRequest = new CreatePredictionRequest
        {
            TransactionType = NormalizeTransactionType(transaction.TransactionType),
            Amount = transaction.Amount,
            OldBalanceOrigin = balances.OldBalanceOrigin,
            NewBalanceOrigin = balances.NewBalanceOrigin,
            OldBalanceDestination = balances.OldBalanceDestination,
            NewBalanceDestination = balances.NewBalanceDestination
        };
        ApplyBalances(transaction, predictionRequest);

        var result = await ScoreTransactionAsync(transaction, predictionRequest, cancellationToken);
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
        ApplyBalances(transaction, predictionRequest);

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
            ModelVersion = result.ModelVersion,
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

    private static PredictionResponse ToResponse(Prediction prediction, double fraudProbability, double confidence, string[] reasons, FraudPredictionResult? modelResult = null)
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
            RiskBreakdown = modelResult?.RiskBreakdown.Length > 0 ? modelResult.RiskBreakdown : BuildRiskBreakdown(prediction),
            ModelName = modelResult?.ModelName,
            ModelTrainingDate = modelResult?.ModelTrainingDate,
            ModelVersion = modelResult?.ModelVersion,
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

    private static RiskBreakdownFactor[] BuildRiskBreakdown(Prediction prediction)
    {
        if (prediction.TransactionId.HasValue
            && prediction.Transaction is not null
            && !HasCompleteBalanceData(prediction.Transaction))
        {
            return
            [
                new()
                {
                    Factor = "Balance data unavailable",
                    Impact = "Neutral",
                    Explanation = "Balance data was not provided, so balance-based risk factors were not evaluated."
                }
            ];
        }

        var originDelta = prediction.OldBalanceOrigin - prediction.NewBalanceOrigin;
        var destinationDelta = prediction.NewBalanceDestination - prediction.OldBalanceDestination;
        var normalizedType = NormalizeTransactionType(prediction.TransactionType);
        var sensitiveType = normalizedType is "TRANSFER" or "CASH_OUT";

        var amountImpact = prediction.Amount >= 1_000_000
            ? "High risk"
            : prediction.Amount >= 100_000 ? "Risk" : "Neutral";
        var amountFactor = prediction.Amount >= 100_000 ? "High transaction amount" : "Transaction amount";
        var amountExplanation = prediction.Amount >= 1_000_000
            ? $"Amount is {FormatMoney(prediction.Amount)}, above the very-high-value threshold."
            : prediction.Amount >= 100_000
                ? $"Amount is {FormatMoney(prediction.Amount)}, above the high-value threshold."
                : $"Amount is {FormatMoney(prediction.Amount)}, below the high-value threshold.";

        var typeImpact = sensitiveType ? "Risk" : "Protective";
        var typeExplanation = sensitiveType
            ? $"{normalizedType} is treated as fraud-sensitive because money leaves or moves between accounts."
            : $"{normalizedType} is not one of the higher-risk transfer or cash-out types.";

        string originImpact;
        string originExplanation;
        if (originDelta <= 0 && prediction.Amount > 0)
        {
            originImpact = "Risk";
            originExplanation = "Origin balance did not decrease even though the transaction amount is positive.";
        }
        else if (prediction.Amount > 0 && Math.Abs(originDelta - prediction.Amount) > prediction.Amount * 0.25m)
        {
            originImpact = "Risk";
            originExplanation = $"Origin balance dropped by {FormatMoney(originDelta)}, which differs from the amount by more than 25%.";
        }
        else
        {
            originImpact = "Protective";
            originExplanation = $"Origin balance dropped by {FormatMoney(originDelta)}, broadly matching the amount.";
        }

        string destinationImpact;
        string destinationExplanation;
        if (destinationDelta < 0)
        {
            destinationImpact = "Risk";
            destinationExplanation = "Destination balance decreased during a transaction that should move funds in.";
        }
        else if (prediction.Amount > 0 && destinationDelta == 0)
        {
            destinationImpact = "Risk";
            destinationExplanation = "Destination balance did not change despite a positive transaction amount.";
        }
        else if (prediction.OldBalanceDestination == 0 && prediction.Amount >= 100_000)
        {
            destinationImpact = "Risk";
            destinationExplanation = "Destination started at zero and received a high-value amount.";
        }
        else
        {
            destinationImpact = "Protective";
            destinationExplanation = $"Destination balance changed by {FormatMoney(destinationDelta)}, consistent with receiving funds.";
        }

        var hasZeroBalanceAfter = prediction.NewBalanceOrigin == 0 || prediction.NewBalanceDestination == 0;

        return
        [
            new()
            {
                Factor = amountFactor,
                Impact = amountImpact,
                Explanation = amountExplanation
            },
            new()
            {
                Factor = "Transfer or cash-out transaction type",
                Impact = typeImpact,
                Explanation = typeExplanation
            },
            new()
            {
                Factor = "Origin account balance drop",
                Impact = originImpact,
                Explanation = originExplanation
            },
            new()
            {
                Factor = "Destination account balance behavior",
                Impact = destinationImpact,
                Explanation = destinationExplanation
            },
            new()
            {
                Factor = "Zero balance after transaction",
                Impact = hasZeroBalanceAfter ? "Risk" : "Protective",
                Explanation = hasZeroBalanceAfter
                    ? "At least one account has a zero balance after the transaction."
                    : "Neither account has a zero balance after the transaction."
            }
        ];
    }

    private static string FormatMoney(decimal value)
    {
        return value.ToString("N2", CultureInfo.InvariantCulture);
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

    private static TransactionBalanceValues ResolveBalances(Transaction transaction, AnalyzeTransactionRequest? request)
    {
        return new TransactionBalanceValues(
            request?.OldBalanceOrigin ?? transaction.OldBalanceOrigin,
            request?.NewBalanceOrigin ?? transaction.NewBalanceOrigin,
            request?.OldBalanceDestination ?? transaction.OldBalanceDestination,
            request?.NewBalanceDestination ?? transaction.NewBalanceDestination);
    }

    private static void ApplyBalances(Transaction transaction, CreatePredictionRequest request)
    {
        transaction.OldBalanceOrigin = request.OldBalanceOriginValue;
        transaction.NewBalanceOrigin = request.NewBalanceOriginValue;
        transaction.OldBalanceDestination = request.OldBalanceDestinationValue;
        transaction.NewBalanceDestination = request.NewBalanceDestinationValue;
    }

    private static string[] ValidateBalances(TransactionBalanceValues balances)
    {
        var errors = new List<string>();
        AddRequiredBalanceError(errors, balances.OldBalanceOrigin, "Old Balance Origin");
        AddRequiredBalanceError(errors, balances.NewBalanceOrigin, "New Balance Origin");
        AddRequiredBalanceError(errors, balances.OldBalanceDestination, "Old Balance Destination");
        AddRequiredBalanceError(errors, balances.NewBalanceDestination, "New Balance Destination");
        return errors.ToArray();
    }

    private static void AddRequiredBalanceError(List<string> errors, decimal? value, string label)
    {
        if (!value.HasValue)
        {
            errors.Add($"{label} is required before analyzing a stored transaction.");
            return;
        }

        if (value.Value < 0)
        {
            errors.Add($"{label} cannot be negative.");
        }
    }

    private async Task<TransactionRiskResult> ScoreTransactionAsync(Transaction transaction, CreatePredictionRequest mlRequest, CancellationToken cancellationToken)
    {
        var ruleResult = ScoreTransaction(transaction);

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
                mlResult.ModelTrainingDate,
                mlResult.ModelVersion);
        }
        catch (FraudPredictionException)
        {
            _logger.LogWarning("ONNX prediction service unavailable while scoring transaction TX-{TransactionId}; using rule-based fallback.", transaction.Id);
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
            BuildStoredTransactionFactors(transaction).Concat(BuildReasonSections(riskFactors, protectiveFactors)).ToArray(),
            SuggestedActionForScore(score),
            score >= 70 ? 0.92 : score >= 40 ? 0.78 : 0.72);
    }

    private static string[] BuildStoredTransactionFactors(Transaction transaction)
    {
        var normalizedType = NormalizeTransactionType(transaction.TransactionType);
        var factors = new List<string>
        {
            $"Input Values|Transaction amount is {transaction.Amount:N2}.",
            $"Input Values|Transaction type is {normalizedType}."
        };

        if (!HasCompleteBalanceData(transaction))
        {
            factors.Add("Balance Movement|Balance data was not provided, so balance-based risk factors were not evaluated.");
            return factors.ToArray();
        }

        var originDelta = transaction.OldBalanceOrigin!.Value - transaction.NewBalanceOrigin!.Value;
        var destinationDelta = transaction.NewBalanceDestination!.Value - transaction.OldBalanceDestination!.Value;
        factors.Add($"Balance Movement|Origin balance changed from {transaction.OldBalanceOrigin:N2} to {transaction.NewBalanceOrigin:N2}, a decrease of {originDelta:N2}.");
        factors.Add($"Balance Movement|Destination balance changed from {transaction.OldBalanceDestination:N2} to {transaction.NewBalanceDestination:N2}, an increase of {destinationDelta:N2}.");

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

        if (transaction.NewBalanceOrigin == 0)
        {
            factors.Add("Risk Factors|Origin account was emptied after the transaction.");
        }

        var originInconsistent = transaction.Amount > 0 && Math.Abs(originDelta - transaction.Amount) > transaction.Amount * 0.25m;
        var destinationInconsistent = transaction.Amount > 0 && Math.Abs(destinationDelta - transaction.Amount) > transaction.Amount * 0.25m;
        if (originInconsistent || destinationInconsistent)
        {
            factors.Add("Risk Factors|Balance movement differs materially from the transaction amount.");
        }
        else
        {
            factors.Add("Protective Factors|Provided balance movement is consistent with the transaction amount.");
        }

        return factors.ToArray();
    }

    private static bool HasCompleteBalanceData(Transaction transaction)
    {
        return transaction.OldBalanceOrigin.HasValue
            && transaction.NewBalanceOrigin.HasValue
            && transaction.OldBalanceDestination.HasValue
            && transaction.NewBalanceDestination.HasValue;
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
        if (!prediction.TransactionId.HasValue || (!prediction.IsFraud && prediction.RiskScore < 70))
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

    private sealed record TransactionBalanceValues(decimal? OldBalanceOrigin, decimal? NewBalanceOrigin, decimal? OldBalanceDestination, decimal? NewBalanceDestination);

    private sealed record TransactionRiskResult(int RiskScore, string RiskLevel, string Status, string[] Reasons, string SuggestedAction, double Confidence, string? ModelName = null, string? ModelTrainingDate = null, string? ModelVersion = null);
}
