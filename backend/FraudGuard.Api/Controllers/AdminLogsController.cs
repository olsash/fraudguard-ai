using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/logs")]
public class AdminLogsController : ControllerBase
{
    private static readonly string[] Levels = ["Info", "Warning", "Error", "Success"];
    private static readonly string[] Sources = ["auth", "api", "admin", "prediction", "transaction", "alert", "profile", "settings"];

    private readonly AppDbContext _dbContext;

    public AdminLogsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<PagedSystemLogsDto>> GetLogs(
        [FromQuery] string? search,
        [FromQuery] string? level,
        [FromQuery] string? source,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = _dbContext.SystemLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(log =>
                log.Message.Contains(term)
                || (log.UserName != null && log.UserName.Contains(term))
                || (log.Path != null && log.Path.Contains(term))
                || (log.IpAddress != null && log.IpAddress.Contains(term)));
        }

        var normalizedLevel = NormalizeLevel(level);
        if (normalizedLevel is not null)
        {
            query = query.Where(log => log.Level == normalizedLevel);
        }

        var normalizedSource = NormalizeSource(source);
        if (normalizedSource is not null)
        {
            query = query.Where(log => log.Source == normalizedSource);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(log => log.CreatedAt >= fromDate.Value.Date);
        }

        if (toDate.HasValue)
        {
            query = query.Where(log => log.CreatedAt < toDate.Value.Date.AddDays(1));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(log => log.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(log => ToDto(log))
            .ToListAsync(cancellationToken);

        return Ok(new PagedSystemLogsDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpDelete("clear")]
    public async Task<ActionResult> ClearLogs(CancellationToken cancellationToken)
    {
        var deleted = await _dbContext.SystemLogs.ExecuteDeleteAsync(cancellationToken);
        return Ok(new { message = $"Cleared {deleted} system logs." });
    }

    private static SystemLogDto ToDto(SystemLog log)
    {
        return new SystemLogDto
        {
            Id = log.Id,
            Level = log.Level,
            Source = log.Source,
            Message = log.Message,
            UserId = log.UserId,
            UserName = log.UserName,
            Method = log.Method,
            Path = log.Path,
            IpAddress = log.IpAddress,
            CreatedAt = log.CreatedAt
        };
    }

    private static string? NormalizeLevel(string? level)
    {
        if (string.IsNullOrWhiteSpace(level) || level.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Levels.FirstOrDefault(item => item.Equals(level.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeSource(string? source)
    {
        if (string.IsNullOrWhiteSpace(source) || source.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Sources.FirstOrDefault(item => item.Equals(source.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}
