using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Services;

public static class DevelopmentDemoUserSeeder
{
    private const string OldDemoDomain = "@credit.com";
    private const string NewDemoDomain = "@fraudguard.com";

    public static async Task SeedAsync(IServiceProvider services, ILogger logger, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await SeedAsync(dbContext, logger, cancellationToken);
    }

    public static async Task SeedAsync(AppDbContext dbContext, ILogger logger, CancellationToken cancellationToken = default)
    {
        await BackfillDemoEmailDomainAsync(dbContext, logger, cancellationToken);
        await NormalizeStoredRolesAsync(dbContext, cancellationToken);
        await EnsureDemoUserAsync(dbContext, "admin@fraudguard.com", "FraudGuard Admin", "admin123", ApplicationRoles.Admin, cancellationToken);
        await EnsureDemoUserAsync(dbContext, "user@fraudguard.com", "FraudGuard User", "user123", ApplicationRoles.User, cancellationToken);
        await EnsureDemoUserAsync(dbContext, "analyst@fraudguard.com", "Fraud Analyst", "analyst123", ApplicationRoles.FraudAnalyst, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task BackfillDemoEmailDomainAsync(AppDbContext dbContext, ILogger logger, CancellationToken cancellationToken)
    {
        var users = await dbContext.Users
            .Where(user => user.Email.EndsWith(OldDemoDomain))
            .ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            var localPart = user.Email[..^OldDemoDomain.Length];
            var newEmail = $"{localPart}{NewDemoDomain}".ToLowerInvariant();
            var collision = await dbContext.Users.AnyAsync(item => item.Id != user.Id && item.Email == newEmail, cancellationToken);

            if (collision)
            {
                logger.LogWarning("Skipped demo email migration for user {UserId}; {Email} already exists.", user.Id, newEmail);
                continue;
            }

            user.Email = newEmail;
            user.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static async Task NormalizeStoredRolesAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var users = await dbContext.Users.ToListAsync(cancellationToken);
        foreach (var user in users)
        {
            var normalizedRole = ApplicationRoles.Normalize(user.Role);
            if (normalizedRole is not null && user.Role != normalizedRole)
            {
                user.Role = normalizedRole;
                user.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private static async Task EnsureDemoUserAsync(
        AppDbContext dbContext,
        string email,
        string fullName,
        string password,
        string role,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Email == normalizedEmail, cancellationToken);

        if (user is null)
        {
            dbContext.Users.Add(new User
            {
                FullName = fullName,
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = role,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            return;
        }

        user.FullName = string.IsNullOrWhiteSpace(user.FullName) ? fullName : user.FullName;
        user.Role = role;
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
    }
}
