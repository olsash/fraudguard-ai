using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Services;

public static class MerchantDevelopmentSeeder
{
    private static readonly DateTime SeedDate = new(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc);

    private static readonly MerchantSeed[] Merchants =
    [
        new("Viva Fresh Store", "VIVA-FRESH", "Grocery", "5411", "Kosovo", "RBKODEMO", "Low", "FGM-1100-0001", "XK05MERCH110000000001"),
        new("Albi Mall", "ALBI-MALL", "Retail", "5311", "Kosovo", "PCBKKDEMO", "Low", "FGM-1200-0002", "XK05MERCH120000000002"),
        new("Gjirafa50", "GJIRAFA50", "Electronics", "5732", "Kosovo", "NLBADEMO", "Medium", "FGM-1300-0003", "XK05MERCH130000000003"),
        new("Meridian Express", "MERIDIAN-EXP", "Grocery", "5411", "Kosovo", "TEBKDEMO", "Low", "FGM-1400-0004", "XK05MERCH140000000004"),
        new("Kosovo Energy", "KOSOVO-ENERGY", "Utilities", "4900", "Kosovo", "BKTKDEMO", "Medium", "FGM-1500-0005", "XK05MERCH150000000005"),
        new("Dukagjini Bookstore", "DUKAGJINI-BOOKS", "Books", "5942", "Kosovo", "BEKODEMO", "Low", "FGM-1600-0006", "XK05MERCH160000000006")
    ];

    public static async Task SeedAsync(AppDbContext dbContext, ILogger logger, CancellationToken cancellationToken = default)
    {
        var strategy = dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = IsInMemoryDatabase(dbContext)
                ? null
                : await dbContext.Database.BeginTransactionAsync(cancellationToken);

            foreach (var seed in Merchants)
            {
                var bank = await dbContext.Banks
                    .FirstOrDefaultAsync(item => item.SwiftCode == seed.BankSwiftCode && item.IsActive, cancellationToken);

                if (bank is null)
                {
                    logger.LogWarning("Skipping development merchant {MerchantCode}; active bank {SwiftCode} was not found.", seed.MerchantCode, seed.BankSwiftCode);
                    continue;
                }

                var merchant = await dbContext.Merchants
                    .FirstOrDefaultAsync(item => item.MerchantCode == seed.MerchantCode, cancellationToken);

                if (merchant is null)
                {
                    merchant = new Merchant
                    {
                        Name = seed.Name,
                        MerchantCode = seed.MerchantCode,
                        Category = seed.Category,
                        MerchantCategoryCode = seed.MerchantCategoryCode,
                        Country = seed.Country,
                        BankId = bank.Id,
                        RiskLevel = seed.RiskLevel,
                        IsVerified = true,
                        IsActive = true,
                        CreatedAt = SeedDate
                    };
                    dbContext.Merchants.Add(merchant);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    merchant.Name = seed.Name;
                    merchant.Category = seed.Category;
                    merchant.MerchantCategoryCode = seed.MerchantCategoryCode;
                    merchant.Country = seed.Country;
                    merchant.BankId = bank.Id;
                    merchant.RiskLevel = seed.RiskLevel;
                    merchant.IsVerified = true;
                    merchant.IsActive = true;
                    merchant.UpdatedAt = DateTime.UtcNow;
                }

                var settlementAccount = await dbContext.BankAccounts
                    .FirstOrDefaultAsync(account => account.AccountNumber == seed.SettlementAccountNumber || account.IBAN == seed.SettlementIban, cancellationToken);

                if (settlementAccount is null)
                {
                    settlementAccount = new BankAccount
                    {
                        UserId = null,
                        MerchantId = merchant.Id,
                        BankId = bank.Id,
                        AccountName = $"{seed.Name} Settlement",
                        AccountHolderName = seed.Name,
                        AccountNumber = seed.SettlementAccountNumber,
                        IBAN = seed.SettlementIban,
                        Currency = "EUR",
                        CurrentBalance = 0m,
                        AccountType = "Merchant Settlement",
                        IsActive = true,
                        CreatedAt = SeedDate
                    };
                    dbContext.BankAccounts.Add(settlementAccount);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    settlementAccount.UserId = null;
                    settlementAccount.MerchantId = merchant.Id;
                    settlementAccount.BankId = bank.Id;
                    settlementAccount.AccountName = $"{seed.Name} Settlement";
                    settlementAccount.AccountHolderName = seed.Name;
                    settlementAccount.Currency = "EUR";
                    settlementAccount.AccountType = "Merchant Settlement";
                    settlementAccount.IsActive = true;
                    settlementAccount.UpdatedAt = DateTime.UtcNow;
                }

                if (merchant.SettlementBankAccountId != settlementAccount.Id)
                {
                    merchant.SettlementBankAccountId = settlementAccount.Id;
                    merchant.UpdatedAt = DateTime.UtcNow;
                }

                await dbContext.SaveChangesAsync(cancellationToken);
            }

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        });
    }

    private static bool IsInMemoryDatabase(AppDbContext dbContext)
    {
        return dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }

    private sealed record MerchantSeed(
        string Name,
        string MerchantCode,
        string Category,
        string MerchantCategoryCode,
        string Country,
        string BankSwiftCode,
        string RiskLevel,
        string SettlementAccountNumber,
        string SettlementIban);
}
