using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
[Authorize]
[Route("api/[controller]")]
public class AlertsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ISystemLogService _systemLogService;

    public AlertsController(AppDbContext dbContext, ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _systemLogService = systemLogService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FraudAlertDto>>> GetAlerts(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var query = _dbContext.FraudAlerts
            .AsNoTracking()
            .Include(alert => alert.Transaction)
            .Include(alert => alert.Prediction)
            .Include(alert => alert.User)
            .AsQueryable();

        if (User.IsInRole(ApplicationRoles.FraudAnalyst))
        {
            query = query.Where(alert => _dbContext.FraudCases.Any(fraudCase =>
                fraudCase.FraudAlertId == alert.Id
                && (fraudCase.AssignedAnalystId == userId.Value
                    || fraudCase.AssignedAnalystId == null)));
        }
        else if (!User.IsInRole(ApplicationRoles.Admin))
        {
            query = query.Where(alert => alert.UserId == userId.Value);
        }

        var alerts = await query
            .OrderByDescending(alert => alert.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(alerts.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FraudAlertDto>> GetAlert(int id, CancellationToken cancellationToken)
    {
        var alert = await FindAccessibleAlertAsync(id, cancellationToken);
        if (alert is null)
        {
            return NotFound(new { message = "Alert not found." });
        }

        return Ok(ToDto(alert));
    }

    [Authorize(Roles = ApplicationRoles.Admin)]
    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<FraudAlertDto>> UpdateStatus(
        int id,
        UpdateFraudAlertStatusRequest request,
        CancellationToken cancellationToken)
    {
        var status = request.Status.Trim().ToLowerInvariant();
        if (status is not ("open" or "investigating" or "resolved"))
        {
            return BadRequest(new { message = "Status must be open, investigating, or resolved." });
        }

        var alert = await FindAccessibleAlertAsync(id, cancellationToken, tracked: true);
        if (alert is null)
        {
            return NotFound(new { message = "Alert not found." });
        }

        alert.Status = status;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "alert", $"Alert AL-{alert.Id} status updated to {status}.", alert.UserId, alert.User?.FullName, cancellationToken);

        return Ok(ToDto(alert));
    }

    [Authorize(Roles = ApplicationRoles.Admin)]
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> DeleteAlert(int id, CancellationToken cancellationToken)
    {
        var alert = await _dbContext.FraudAlerts.FindAsync([id], cancellationToken);
        if (alert is null)
        {
            return NotFound(new { message = "Alert not found." });
        }

        _dbContext.FraudAlerts.Remove(alert);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Warning", "alert", $"Alert AL-{id} deleted.", alert.UserId, null, cancellationToken);

        return Ok(new { message = "Alert deleted successfully." });
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private async Task<FraudAlert?> FindAccessibleAlertAsync(
        int id,
        CancellationToken cancellationToken,
        bool tracked = false)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return null;
        }

        var query = _dbContext.FraudAlerts
            .Include(alert => alert.Transaction)
            .Include(alert => alert.Prediction)
            .Include(alert => alert.User)
            .AsQueryable();

        if (!tracked)
        {
            query = query.AsNoTracking();
        }

        if (User.IsInRole(ApplicationRoles.FraudAnalyst))
        {
            query = query.Where(alert => _dbContext.FraudCases.Any(fraudCase =>
                fraudCase.FraudAlertId == alert.Id
                && (fraudCase.AssignedAnalystId == userId.Value
                    || fraudCase.AssignedAnalystId == null)));
        }
        else if (!User.IsInRole(ApplicationRoles.Admin))
        {
            query = query.Where(alert => alert.UserId == userId.Value);
        }

        return await query.FirstOrDefaultAsync(alert => alert.Id == id, cancellationToken);
    }

    private static FraudAlertDto ToDto(FraudAlert alert)
    {
        var amount = alert.Transaction?.Amount ?? alert.Prediction?.Amount ?? 0;
        var transactionType = alert.Transaction?.TransactionType ?? alert.Prediction?.TransactionType ?? string.Empty;
        var currency = alert.Transaction?.Currency ?? "USD";
        var reason = ShortReason(alert);

        return new FraudAlertDto
        {
            Id = alert.Id,
            UserId = alert.UserId,
            UserName = alert.User?.FullName,
            TransactionId = alert.TransactionId,
            PredictionId = alert.PredictionId,
            Title = alert.Title,
            Severity = alert.Severity,
            Status = alert.Status,
            RiskScore = alert.RiskScore,
            Merchant = alert.Transaction?.Merchant ?? (alert.PredictionId.HasValue ? "Manual prediction" : string.Empty),
            TransactionType = transactionType,
            Amount = amount,
            Currency = currency,
            Country = alert.Transaction?.Country ?? string.Empty,
            ShortReason = reason,
            CreatedAt = alert.CreatedAt
        };
    }

    private static string ShortReason(FraudAlert alert)
    {
        if (alert.Prediction is null || string.IsNullOrWhiteSpace(alert.Prediction.Explanation))
        {
            return alert.RiskScore >= 70
                ? "Risk score exceeded the high-risk fraud threshold."
                : "Prediction requires fraud review.";
        }

        try
        {
            var reasons = System.Text.Json.JsonSerializer.Deserialize<string[]>(alert.Prediction.Explanation) ?? [];
            var reason = reasons.FirstOrDefault(item => item.StartsWith("Risk Factors|", StringComparison.OrdinalIgnoreCase))
                ?? reasons.FirstOrDefault(item => item.StartsWith("Final Decision|", StringComparison.OrdinalIgnoreCase))
                ?? reasons.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item));

            if (!string.IsNullOrWhiteSpace(reason))
            {
                var delimiter = reason.IndexOf('|');
                return delimiter >= 0 ? reason[(delimiter + 1)..].Trim() : reason.Trim();
            }
        }
        catch (System.Text.Json.JsonException)
        {
            // Fall through to the risk-score reason below.
        }

        return alert.RiskScore >= 70
            ? "Risk score exceeded the high-risk fraud threshold."
            : "Prediction requires fraud review.";
    }
}
