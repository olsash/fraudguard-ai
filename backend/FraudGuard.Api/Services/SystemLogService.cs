using FraudGuard.Api.Data;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services;

public class SystemLogService : ISystemLogService
{
    private readonly AppDbContext _dbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SystemLogService(AppDbContext dbContext, IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    public Task LogAsync(
        string level,
        string source,
        string message,
        User? user,
        CancellationToken cancellationToken = default)
    {
        return LogAsync(level, source, message, user?.Id, user?.FullName, cancellationToken);
    }

    public async Task LogAsync(
        string level,
        string source,
        string message,
        int? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var request = httpContext?.Request;

        _dbContext.SystemLogs.Add(new SystemLog
        {
            Level = NormalizeLevel(level),
            Source = NormalizeSource(source),
            Message = message.Trim(),
            UserId = userId,
            UserName = string.IsNullOrWhiteSpace(userName) ? null : userName.Trim(),
            Method = request?.Method,
            Path = request?.Path.Value,
            IpAddress = httpContext?.Connection.RemoteIpAddress?.ToString(),
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeLevel(string level)
    {
        return level.Trim().ToLowerInvariant() switch
        {
            "warning" or "warn" => "Warning",
            "error" => "Error",
            "success" => "Success",
            _ => "Info"
        };
    }

    private static string NormalizeSource(string source)
    {
        var normalized = source.Trim().ToLowerInvariant();
        return normalized is "auth" or "api" or "admin" or "prediction" or "transaction" or "alert" or "profile" or "settings"
            ? normalized
            : "api";
    }
}
