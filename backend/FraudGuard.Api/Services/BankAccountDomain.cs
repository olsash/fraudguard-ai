using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services;

public static partial class BankAccountDomain
{
    public const string Currency = "EUR";
    public const int MaxActiveAccountsPerUser = 3;
    public const int MaxFailedVerificationAttempts = 5;
    public static readonly TimeSpan VerificationAttemptWindow = TimeSpan.FromMinutes(15);
    private const int HashIterations = 100_000;
    private const int HashBytes = 32;
    private static readonly byte[] HashSalt = SHA256.HashData(Encoding.UTF8.GetBytes("FraudGuard-AI simulated bank account verification v1"));

    public static string NormalizeAccountNumber(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
    }

    public static string NormalizeIban(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
    }

    public static string NormalizeHolderName(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : string.Join(" ", value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
    }

    public static bool IsValidHolderName(string? value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && value.Trim().Length <= 150
            && HolderNamePattern().IsMatch(value.Trim());
    }

    public static bool IsValidAccountNumber(string value)
    {
        return AccountNumberPattern().IsMatch(value);
    }

    public static bool IsValidIban(string value)
    {
        return IbanPattern().IsMatch(value);
    }

    public static bool IsValidVerificationCode(string? value)
    {
        return !string.IsNullOrWhiteSpace(value) && VerificationCodePattern().IsMatch(value.Trim());
    }

    public static string HashVerificationCode(string code)
    {
        return HashSecret($"FraudGuard-DemoBankAccount:v1:{code.Trim()}");
    }

    public static bool VerifyCode(string submittedCode, string storedHash)
    {
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(HashVerificationCode(submittedCode)),
            Encoding.UTF8.GetBytes(storedHash));
    }

    public static string HashLookup(int userId, int bankId, string accountNumber, string iban)
    {
        return HashSecret($"FraudGuard-Attempt:v1:{userId}:{bankId}:{accountNumber}:{iban}");
    }

    public static string MaskAccountNumber(string value)
    {
        var trimmed = value.Trim();
        var lastFour = trimmed.Length <= 4 ? trimmed : trimmed[^4..];
        return $"•••• {lastFour}";
    }

    public static string MaskIban(string value)
    {
        var compact = NormalizeIban(value);
        if (compact.Length <= 8)
        {
            return MaskAccountNumber(compact);
        }

        return $"{compact[..4]} •••• •••• {compact[^4..]}";
    }

    public static BankAccount CreateLinkedAccount(int userId, DemoBankAccount demoAccount)
    {
        return new BankAccount
        {
            UserId = userId,
            BankId = demoAccount.BankId,
            AccountName = $"{demoAccount.AccountType} Account",
            AccountHolderName = demoAccount.AccountHolderName,
            AccountNumber = demoAccount.AccountNumber,
            IBAN = demoAccount.Iban,
            Currency = demoAccount.Currency,
            CurrentBalance = demoAccount.CurrentBalance,
            AccountType = demoAccount.AccountType,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static string HashSecret(string value)
    {
        var bytes = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(value),
            HashSalt,
            HashIterations,
            HashAlgorithmName.SHA256,
            HashBytes);
        return Convert.ToHexString(bytes);
    }

    [GeneratedRegex("^[A-Za-z][A-Za-z .'-]{1,149}$")]
    private static partial Regex HolderNamePattern();

    [GeneratedRegex("^[A-Z0-9]{8,20}$")]
    private static partial Regex AccountNumberPattern();

    [GeneratedRegex("^XK05[A-Z0-9]{14,20}$")]
    private static partial Regex IbanPattern();

    [GeneratedRegex("^\\d{6}$")]
    private static partial Regex VerificationCodePattern();
}


