using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private static readonly string[] RiskLevels = ["Low", "Medium", "High", "Critical"];
    private readonly AppDbContext _dbContext;

    public DashboardController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var isAdmin = User.IsInRole("Admin");
        var predictionsQuery = _dbContext.Predictions.AsNoTracking();

        if (!isAdmin)
        {
            predictionsQuery = predictionsQuery.Where(prediction => prediction.UserId == userId.Value);
        }

        var totalPredictions = await predictionsQuery.CountAsync(cancellationToken);
        var safeTransactions = await predictionsQuery.CountAsync(prediction => !prediction.IsFraud, cancellationToken);
        var fraudTransactions = await predictionsQuery.CountAsync(prediction => prediction.IsFraud, cancellationToken);

        var averageRiskScore = totalPredictions == 0
            ? 0
            : await predictionsQuery.AverageAsync(prediction => prediction.RiskScore, cancellationToken);

        var highestRiskScore = totalPredictions == 0
            ? 0
            : await predictionsQuery.MaxAsync(prediction => prediction.RiskScore, cancellationToken);

        var latestPrediction = await predictionsQuery
            .OrderByDescending(prediction => prediction.CreatedAt)
            .Select(prediction => new RecentPredictionDto
            {
                Id = prediction.Id,
                UserId = prediction.UserId,
                UserEmail = isAdmin ? prediction.User != null ? prediction.User.Email : null : null,
                TransactionType = prediction.TransactionType,
                Amount = prediction.Amount,
                RiskScore = prediction.RiskScore,
                RiskLevel = prediction.RiskLevel,
                IsFraud = prediction.IsFraud,
                SuggestedAction = prediction.SuggestedAction,
                CreatedAt = prediction.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        var recentPredictions = await predictionsQuery
            .OrderByDescending(prediction => prediction.CreatedAt)
            .Take(8)
            .Select(prediction => new RecentPredictionDto
            {
                Id = prediction.Id,
                UserId = prediction.UserId,
                UserEmail = isAdmin ? prediction.User != null ? prediction.User.Email : null : null,
                TransactionType = prediction.TransactionType,
                Amount = prediction.Amount,
                RiskScore = prediction.RiskScore,
                RiskLevel = prediction.RiskLevel,
                IsFraud = prediction.IsFraud,
                SuggestedAction = prediction.SuggestedAction,
                CreatedAt = prediction.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var riskCounts = await predictionsQuery
            .GroupBy(prediction => prediction.RiskLevel)
            .Select(group => new { RiskLevel = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var sevenDayStart = DateTime.UtcNow.Date.AddDays(-6);
        var dailyCounts = await predictionsQuery
            .Where(prediction => prediction.CreatedAt >= sevenDayStart)
            .GroupBy(prediction => prediction.CreatedAt.Date)
            .Select(group => new
            {
                Date = group.Key,
                Total = group.Count(),
                Safe = group.Count(prediction => !prediction.IsFraud),
                Fraud = group.Count(prediction => prediction.IsFraud)
            })
            .ToListAsync(cancellationToken);

        var summary = new DashboardSummaryDto
        {
            TotalPredictions = totalPredictions,
            SafeTransactions = safeTransactions,
            FraudTransactions = fraudTransactions,
            AverageRiskScore = Math.Round(averageRiskScore, 1),
            HighestRiskScore = highestRiskScore,
            LatestPrediction = latestPrediction,
            RecentPredictions = recentPredictions,
            RiskDistribution = RiskLevels
                .Select(level => new RiskDistributionDto
                {
                    RiskLevel = level,
                    Count = riskCounts.FirstOrDefault(item => item.RiskLevel == level)?.Count ?? 0
                })
                .ToList(),
            PredictionsPerDay = Enumerable.Range(0, 7)
                .Select(offset =>
                {
                    var date = sevenDayStart.AddDays(offset);
                    var counts = dailyCounts.FirstOrDefault(item => item.Date == date);

                    return new PredictionChartPointDto
                    {
                        Date = DateOnly.FromDateTime(date),
                        Total = counts?.Total ?? 0,
                        Safe = counts?.Safe ?? 0,
                        Fraud = counts?.Fraud ?? 0
                    };
                })
                .ToList()
        };

        if (isAdmin)
        {
            summary.TotalUsers = await _dbContext.Users.AsNoTracking().CountAsync(cancellationToken);
            summary.HighRiskCases = await predictionsQuery.CountAsync(prediction => prediction.RiskLevel == "High", cancellationToken);
            summary.CriticalRiskCases = await predictionsQuery.CountAsync(prediction => prediction.RiskLevel == "Critical", cancellationToken);
        }

        return Ok(summary);
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

}
