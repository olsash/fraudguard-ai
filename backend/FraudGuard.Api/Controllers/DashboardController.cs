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

        if (!isAdmin)
        {
            predictionsQuery = predictionsQuery.Where(prediction => prediction.UserId == userId.Value);
            transactionsQuery = transactionsQuery.Where(transaction => transaction.UserId == userId.Value);
        }

        var totalPredictions = await predictionsQuery.CountAsync(cancellationToken);
        var totalTransactions = await transactionsQuery.CountAsync(cancellationToken);
        var pendingTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "pending", cancellationToken);
        var safeTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "safe", cancellationToken);
        var reviewTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "review", cancellationToken);
        var fraudTransactions = await transactionsQuery.CountAsync(transaction => transaction.Status == "fraud", cancellationToken);
        var analyzedTransactionsQuery = transactionsQuery.Where(transaction => transaction.RiskScore.HasValue);

        var hasAnalyzedTransactions = await analyzedTransactionsQuery.AnyAsync(cancellationToken);
        var averageRiskScore = !hasAnalyzedTransactions
            ? 0
            : await analyzedTransactionsQuery.AverageAsync(transaction => transaction.RiskScore!.Value, cancellationToken);

        var highestRiskScore = !hasAnalyzedTransactions
            ? 0
            : await analyzedTransactionsQuery.MaxAsync(transaction => transaction.RiskScore!.Value, cancellationToken);

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
            ["Low"] = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore < 40, cancellationToken),
            ["Medium"] = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore >= 40 && transaction.RiskScore < 70, cancellationToken),
            ["High"] = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore >= 70 && transaction.RiskScore < 90, cancellationToken),
            ["Critical"] = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore >= 90, cancellationToken)
        };

        var sevenDayStart = DateTime.UtcNow.Date.AddDays(-6);
        var dailyCounts = await transactionsQuery
            .Where(transaction => transaction.CreatedAt >= sevenDayStart)
            .GroupBy(transaction => transaction.CreatedAt.Date)
            .Select(group => new
            {
                Date = group.Key,
                Total = group.Count(),
                Safe = group.Count(transaction => transaction.Status == "safe"),
                Fraud = group.Count(transaction => transaction.Status == "fraud")
            })
            .ToListAsync(cancellationToken);

        var summary = new DashboardSummaryDto
        {
            TotalPredictions = totalPredictions,
            TotalTransactions = totalTransactions,
            PendingTransactions = pendingTransactions,
            SafeTransactions = safeTransactions,
            ReviewTransactions = reviewTransactions,
            FraudTransactions = fraudTransactions,
            AverageRiskScore = Math.Round(averageRiskScore, 1),
            HighestRiskScore = highestRiskScore,
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
            summary.HighRiskCases = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore >= 70 && transaction.RiskScore < 90, cancellationToken);
            summary.CriticalRiskCases = await analyzedTransactionsQuery.CountAsync(transaction => transaction.RiskScore >= 90, cancellationToken);
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
