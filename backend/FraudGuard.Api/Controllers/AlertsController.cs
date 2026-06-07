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
public class AlertsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public AlertsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
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
            .Include(alert => alert.User)
            .AsQueryable();

        if (!User.IsInRole("Admin"))
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

    [Authorize(Roles = "Admin")]
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

        return Ok(ToDto(alert));
    }

    [Authorize(Roles = "Admin")]
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
            .Include(alert => alert.User)
            .AsQueryable();

        if (!tracked)
        {
            query = query.AsNoTracking();
        }

        if (!User.IsInRole("Admin"))
        {
            query = query.Where(alert => alert.UserId == userId.Value);
        }

        return await query.FirstOrDefaultAsync(alert => alert.Id == id, cancellationToken);
    }

    private static FraudAlertDto ToDto(FraudAlert alert)
    {
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
            Merchant = alert.Transaction?.Merchant ?? string.Empty,
            Amount = alert.Transaction?.Amount ?? 0,
            Currency = alert.Transaction?.Currency ?? "USD",
            Country = alert.Transaction?.Country ?? string.Empty,
            CreatedAt = alert.CreatedAt
        };
    }
}
