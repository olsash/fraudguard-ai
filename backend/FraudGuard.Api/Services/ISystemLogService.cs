using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services;

public interface ISystemLogService
{
    Task LogAsync(
        string level,
        string source,
        string message,
        int? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default);

    Task LogAsync(
        string level,
        string source,
        string message,
        User? user,
        CancellationToken cancellationToken = default);
}
