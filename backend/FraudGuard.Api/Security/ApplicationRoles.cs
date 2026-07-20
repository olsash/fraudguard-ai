using System.Security.Claims;

namespace FraudGuard.Api.Security;

public static class ApplicationRoles
{
    public const string Admin = "Admin";
    public const string FraudAnalyst = "FraudAnalyst";
    public const string User = "User";
    public const string AdminOrFraudAnalyst = Admin + "," + FraudAnalyst;

    public static readonly string[] All = [Admin, FraudAnalyst, User];

    public static string? Normalize(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return null;
        }

        var normalized = role.Trim()
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .ToLowerInvariant();

        return normalized switch
        {
            "admin" => Admin,
            "fraudanalyst" => FraudAnalyst,
            "analyst" => FraudAnalyst,
            "user" => User,
            _ => null
        };
    }

    public static bool IsPrivilegedReviewRole(ClaimsPrincipal principal)
    {
        return principal.IsInRole(Admin) || principal.IsInRole(FraudAnalyst);
    }
}
