using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
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

    public TransactionsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
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

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Amount must be greater than 0." });
        }

        var transaction = new Transaction
        {
            UserId = userId.Value,
            Merchant = request.Merchant.Trim(),
            Category = request.Category.Trim(),
            Country = request.Country.Trim(),
            Amount = request.Amount,
            Currency = NormalizeCurrency(request.Currency),
            RiskScore = null,
            Status = "pending",
            TransactionType = request.TransactionType.Trim().ToUpperInvariant(),
            Description = NormalizeOptional(request.Description),
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Transactions.Add(transaction);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var created = await _dbContext.Transactions
            .AsNoTracking()
            .Include(item => item.User)
            .FirstAsync(item => item.Id == transaction.Id, cancellationToken);

        return CreatedAtAction(nameof(GetTransaction), new { id = transaction.Id }, ToResponse(created));
    }

    [Authorize(Roles = "Admin")]
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
            .Include(transaction => transaction.Predictions)
            .AsQueryable();

        return User.IsInRole("Admin")
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
            Merchant = transaction.Merchant,
            Category = transaction.Category,
            Country = transaction.Country,
            Amount = transaction.Amount,
            Currency = transaction.Currency,
            RiskScore = transaction.RiskScore,
            Status = transaction.Status,
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
