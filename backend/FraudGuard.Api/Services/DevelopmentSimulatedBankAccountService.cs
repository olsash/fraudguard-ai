using System.Security.Cryptography;
using System.Text;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Services;

public class DevelopmentSimulatedBankAccountService : IDevelopmentSimulatedBankAccountService
{
    private static readonly IReadOnlyDictionary<int, BankTemplate> BankTemplates = new Dictionary<int, BankTemplate>
    {
        [1] = new("1100", "RBKO", "Current", 5200m),
        [2] = new("1200", "PCBK", "Savings", 9800m),
        [3] = new("1300", "NLBK", "Current", 6850m),
        [4] = new("1400", "TEBK", "Savings", 11200m),
        [5] = new("1500", "BKTK", "Current", 7400m),
        [6] = new("1600", "BEKO", "Savings", 13400m)
    };

    private readonly AppDbContext _dbContext;
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;

    public DevelopmentSimulatedBankAccountService(
        AppDbContext dbContext,
        IWebHostEnvironment environment,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _environment = environment;
        _configuration = configuration;
    }

    public async Task<DevelopmentSimulatedBankCredentialsDto> GetOrCreateCredentialsAsync(int currentUserId, int bankId, CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            throw new KeyNotFoundException("Development simulated bank credentials are unavailable.");
        }

        var user = await _dbContext.Users.FindAsync([currentUserId], cancellationToken);
        if (user is null || !user.IsActive || !string.Equals(user.Role, ApplicationRoles.User, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Development simulated bank credentials are available only to users.");
        }

        var bank = await _dbContext.Banks
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == bankId && item.IsActive, cancellationToken);
        if (bank is null)
        {
            throw new ArgumentException("Select an active banking institution.", nameof(bankId));
        }

        var existing = await _dbContext.DemoBankAccounts
            .Include(account => account.Bank)
            .FirstOrDefaultAsync(account => account.DevelopmentUserId == currentUserId && account.BankId == bankId, cancellationToken);

        if (existing is not null)
        {
            return ToDto(existing, DeriveVerificationCode(currentUserId, bankId), GetBankDisplayName(bank), hideCredentials: existing.IsLinked);
        }

        var template = GetTemplate(bank);
        var displayName = NormalizeDisplayName(user.FullName);
        var code = DeriveVerificationCode(currentUserId, bankId);
        var account = await CreateUniqueAccountAsync(user.Id, bank.Id, displayName, template, code, cancellationToken);

        account.Bank = bank;
        return ToDto(account, code, GetBankDisplayName(bank), hideCredentials: false);
    }

    private async Task<DemoBankAccount> CreateUniqueAccountAsync(
        int userId,
        int bankId,
        string accountHolderName,
        BankTemplate template,
        string verificationCode,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var digits = DeriveDigits($"account:{userId}:{bankId}:{attempt}", 6);
            var suffix = DeriveDigits($"iban:{userId}:{bankId}:{attempt}", 6);
            var accountNumber = $"{template.AccountPrefix}{digits}";
            var iban = $"XK05{template.IbanSegment}{digits}{suffix}";

            var exists = await _dbContext.DemoBankAccounts
                .AnyAsync(account => account.AccountNumber == accountNumber || account.Iban == iban, cancellationToken);
            if (exists)
            {
                continue;
            }

            var balanceOffset = int.Parse(DeriveDigits($"balance:{userId}:{bankId}", 3));
            var account = new DemoBankAccount
            {
                BankId = bankId,
                DevelopmentUserId = userId,
                AccountHolderName = accountHolderName,
                AccountNumber = accountNumber,
                Iban = iban,
                AccountType = template.AccountType,
                Currency = BankAccountDomain.Currency,
                CurrentBalance = template.StartingBalance + balanceOffset,
                VerificationCodeHash = BankAccountDomain.HashVerificationCode(verificationCode),
                IsLinked = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.DemoBankAccounts.Add(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return account;
        }

        throw new InvalidOperationException("Unable to generate unique simulated bank account credentials.");
    }

    private DevelopmentSimulatedBankCredentialsDto ToDto(DemoBankAccount account, string verificationCode, string bankName, bool hideCredentials)
    {
        return new DevelopmentSimulatedBankCredentialsDto
        {
            BankId = account.BankId,
            BankName = bankName,
            AccountHolderName = account.AccountHolderName,
            AccountNumber = hideCredentials ? null : FormatAccountNumber(account.AccountNumber),
            Iban = hideCredentials ? null : FormatIban(account.Iban),
            VerificationCode = hideCredentials ? null : verificationCode,
            AccountType = account.AccountType,
            Currency = account.Currency,
            CurrentBalance = account.CurrentBalance,
            IsAlreadyLinked = account.IsLinked
        };
    }

    private BankTemplate GetTemplate(Bank bank)
    {
        return BankTemplates.TryGetValue(bank.Id, out var template)
            ? template
            : new($"{Math.Clamp(bank.Id, 10, 99)}00", "FGDB", bank.Id % 2 == 0 ? "Savings" : "Current", 5000m + bank.Id * 250m);
    }

    private string DeriveVerificationCode(int userId, int bankId)
    {
        return DeriveDigits($"code:{userId}:{bankId}", 6);
    }

    private string DeriveDigits(string purpose, int length)
    {
        var secret = _configuration["DevelopmentSimulatedBanking:Secret"]
            ?? "FraudGuard-AI-local-development-simulated-banking-secret";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(purpose));
        var number = BitConverter.ToUInt64(hash, 0) % (ulong)Math.Pow(10, length);
        return number.ToString($"D{length}");
    }

    private static string NormalizeDisplayName(string fullName)
    {
        return string.Join(" ", fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string GetBankDisplayName(Bank bank)
    {
        return bank.Country.Equals("Kosovo", StringComparison.OrdinalIgnoreCase) && !bank.Name.Contains("Kosovo", StringComparison.OrdinalIgnoreCase)
            ? $"{bank.Name} - Kosovo"
            : bank.Name;
    }

    private static string FormatAccountNumber(string value)
    {
        var normalized = BankAccountDomain.NormalizeAccountNumber(value);
        return normalized.Length <= 4 ? normalized : $"{normalized[..4]} {normalized[4..]}";
    }

    private static string FormatIban(string value)
    {
        var normalized = BankAccountDomain.NormalizeIban(value);
        return string.Join(" ", Enumerable.Range(0, (int)Math.Ceiling(normalized.Length / 4m))
            .Select(index => normalized.Substring(index * 4, Math.Min(4, normalized.Length - index * 4))));
    }

    private sealed record BankTemplate(string AccountPrefix, string IbanSegment, string AccountType, decimal StartingBalance);
}
