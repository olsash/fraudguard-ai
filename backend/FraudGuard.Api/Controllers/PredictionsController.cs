using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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

    public PredictionsController(AppDbContext dbContext, PythonPredictionService predictionService)
    {
        _dbContext = dbContext;
        _predictionService = predictionService;
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
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }

        var prediction = new Prediction
        {
            UserId = userId.Value,
            TransactionType = request.TransactionType,
            Amount = request.Amount,
            OldBalanceOrigin = request.OldBalanceOrigin,
            NewBalanceOrigin = request.NewBalanceOrigin,
            OldBalanceDestination = request.OldBalanceDestination,
            NewBalanceDestination = request.NewBalanceDestination,
            RiskScore = result.RiskScore,
            RiskLevel = result.RiskLevel,
            IsFraud = result.IsFraud,
            Explanation = JsonSerializer.Serialize(result.Reasons),
            SuggestedAction = result.SuggestedAction,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Predictions.Add(prediction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(prediction, result.FraudProbability, result.Confidence, result.Reasons));
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
            .Where(prediction => prediction.UserId == userId.Value)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(predictions.Select(ToResponse));
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin")]
    public async Task<ActionResult<IEnumerable<PredictionResponse>>> Admin(CancellationToken cancellationToken)
    {
        var predictions = await _dbContext.Predictions
            .AsNoTracking()
            .OrderByDescending(prediction => prediction.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(predictions.Select(ToResponse));
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

    private static PredictionResponse ToResponse(Prediction prediction, double fraudProbability, double confidence, string[] reasons)
    {
        return new PredictionResponse
        {
            Id = prediction.Id,
            UserId = prediction.UserId,
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
            Confidence = confidence,
            Reasons = reasons,
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
}
