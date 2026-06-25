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
        var transactionsQuery = _dbContext.Transactions.AsNoTracking();
        var alertsQuery = _dbContext.FraudAlerts.AsNoTracking();

        if (!isAdmin)
        {
            predictionsQuery = predictionsQuery.Where(prediction => prediction.UserId == userId.Value);
            transactionsQuery = transactionsQuery.Where(transaction => transaction.UserId == userId.Value);
            alertsQuery = alertsQuery.Where(alert => alert.UserId == userId.Value);
        }

        var totalPredictions = await predictionsQuery.CountAsync(cancellationToken);
        var fraudPredictions = await predictionsQuery.CountAsync(prediction => prediction.IsFraud, cancellationToken);
        var nonFraudPredictions = totalPredictions - fraudPredictions;
        var totalTransactions = await transactionsQuery.CountAsync(cancellationToken);
        var pendingTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "pending", cancellationToken);
        var safeTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "safe", cancellationToken);
        var reviewTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "review", cancellationToken);
        var fraudTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "fraud", cancellationToken);

        var hasPredictions = totalPredictions > 0;
        var averageRiskScore = !hasPredictions
            ? 0
            : await predictionsQuery.AverageAsync(prediction => prediction.RiskScore, cancellationToken);

        var highestRiskScore = !hasPredictions
            ? 0
            : await predictionsQuery.MaxAsync(prediction => prediction.RiskScore, cancellationToken);

        var highRiskAlerts = await alertsQuery.CountAsync(
            alert => alert.RiskScore >= 70 || alert.Severity == "high" || alert.Severity == "critical",
            cancellationToken);

        var mostCommonTransactionType = await predictionsQuery
            .GroupBy(prediction => prediction.TransactionType)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key)
            .Select(group => group.Key)
            .FirstOrDefaultAsync(cancellationToken) ?? "N/A";

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

        var riskCounts = new Dictionary<string, int>
        {
            ["Low"] = await predictionsQuery.CountAsync(prediction => prediction.RiskScore < 40, cancellationToken),
            ["Medium"] = await predictionsQuery.CountAsync(prediction => prediction.RiskScore >= 40 && prediction.RiskScore < 70, cancellationToken),
            ["High"] = await predictionsQuery.CountAsync(prediction => prediction.RiskScore >= 70 && prediction.RiskScore < 90, cancellationToken),
            ["Critical"] = await predictionsQuery.CountAsync(prediction => prediction.RiskScore >= 90, cancellationToken)
        };

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
            FraudPredictions = fraudPredictions,
            NonFraudPredictions = nonFraudPredictions,
            TotalTransactions = totalTransactions,
            PendingTransactions = pendingTransactions,
            SafeTransactions = safeTransactions,
            ReviewTransactions = reviewTransactions,
            FraudTransactions = fraudTransactions,
            AverageRiskScore = Math.Round(averageRiskScore, 1),
            HighestRiskScore = highestRiskScore,
            HighRiskAlerts = highRiskAlerts,
            MostCommonTransactionType = mostCommonTransactionType,
            LatestPrediction = latestPrediction,
            RecentPredictions = recentPredictions,
            RiskDistribution = RiskLevels
                .Select(level => new RiskDistributionDto
                {
                    RiskLevel = level,
                    Count = riskCounts[level]
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
            summary.HighRiskCases = await predictionsQuery.CountAsync(prediction => prediction.RiskScore >= 70 && prediction.RiskScore < 90, cancellationToken);
            summary.CriticalRiskCases = await predictionsQuery.CountAsync(prediction => prediction.RiskScore >= 90, cancellationToken);
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
