using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Prediction> Predictions => Set<Prediction>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<FraudAlert> FraudAlerts => Set<FraudAlert>();

    public DbSet<SystemLog> SystemLogs => Set<SystemLog>();

    public DbSet<Bank> Banks => Set<Bank>();

    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();

    public DbSet<Beneficiary> Beneficiaries => Set<Beneficiary>();

    public DbSet<Merchant> Merchants => Set<Merchant>();

    public DbSet<FraudCase> FraudCases => Set<FraudCase>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.FullName).IsRequired().HasMaxLength(150);
            entity.Property(user => user.Email).IsRequired().HasMaxLength(255);
            entity.Property(user => user.PasswordHash).IsRequired();
            entity.Property(user => user.Role).IsRequired().HasMaxLength(50);
            entity.Property(user => user.PhoneNumber).HasMaxLength(50);
            entity.Property(user => user.Address).HasMaxLength(300);
            entity.Property(user => user.ProfileImageUrl).HasMaxLength(1000);
            entity.Property(user => user.IsActive).IsRequired();
            entity.Property(user => user.CreatedAt).IsRequired();
        });

        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = 1,
                FullName = "Credit User",
                Email = "user@credit.com",
                PasswordHash = "$2a$11$753ccYgfz2QJHlSCTMG2a.Swts8DhWf9WAQJQtEz3HN3AUsIHMIXO",
                Role = ApplicationRoles.User,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 2,
                FullName = "Credit Admin",
                Email = "admin@credit.com",
                PasswordHash = "$2a$11$hMS2w0HZwNwlHWet4HN1Ce.tzShAq1G7pJ30aYBQawVUxjn3a.IJC",
                Role = ApplicationRoles.Admin,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            });

        modelBuilder.Entity<Bank>(entity =>
        {
            entity.HasKey(bank => bank.Id);
            entity.Property(bank => bank.Name).IsRequired().HasMaxLength(150);
            entity.Property(bank => bank.Country).IsRequired().HasMaxLength(100);
            entity.Property(bank => bank.SwiftCode).IsRequired().HasMaxLength(20);
            entity.Property(bank => bank.IsActive).IsRequired();
            entity.Property(bank => bank.CreatedAt).IsRequired();
            entity.HasIndex(bank => bank.SwiftCode).IsUnique();
        });

        modelBuilder.Entity<BankAccount>(entity =>
        {
            entity.HasKey(account => account.Id);
            entity.Property(account => account.AccountNumber).IsRequired().HasMaxLength(34);
            entity.Property(account => account.IBAN).IsRequired().HasMaxLength(34);
            entity.Property(account => account.Currency).IsRequired().HasMaxLength(10);
            entity.Property(account => account.CurrentBalance).HasColumnType("decimal(18,2)");
            entity.Property(account => account.AccountType).IsRequired().HasMaxLength(40);
            entity.Property(account => account.IsActive).IsRequired();
            entity.Property(account => account.CreatedAt).IsRequired();
            entity.Property(account => account.RowVersion).IsRowVersion();
            entity.HasIndex(account => account.AccountNumber).IsUnique();
            entity.HasIndex(account => account.IBAN).IsUnique();
            entity.HasOne(account => account.User)
                .WithMany()
                .HasForeignKey(account => account.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(account => account.Bank)
                .WithMany(bank => bank.BankAccounts)
                .HasForeignKey(account => account.BankId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Beneficiary>(entity =>
        {
            entity.HasKey(beneficiary => beneficiary.Id);
            entity.Property(beneficiary => beneficiary.FullName).IsRequired().HasMaxLength(150);
            entity.Property(beneficiary => beneficiary.MaskedAccountReference).IsRequired().HasMaxLength(34);
            entity.Property(beneficiary => beneficiary.CreatedAt).IsRequired();
            entity.HasIndex(beneficiary => new { beneficiary.UserId, beneficiary.FullName, beneficiary.MaskedAccountReference });
            entity.HasOne(beneficiary => beneficiary.User)
                .WithMany()
                .HasForeignKey(beneficiary => beneficiary.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(beneficiary => beneficiary.Bank)
                .WithMany()
                .HasForeignKey(beneficiary => beneficiary.BankId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(beneficiary => beneficiary.DestinationBankAccount)
                .WithMany()
                .HasForeignKey(beneficiary => beneficiary.DestinationBankAccountId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<Merchant>(entity =>
        {
            entity.HasKey(merchant => merchant.Id);
            entity.Property(merchant => merchant.Name).IsRequired().HasMaxLength(150);
            entity.Property(merchant => merchant.Category).IsRequired().HasMaxLength(100);
            entity.Property(merchant => merchant.Country).IsRequired().HasMaxLength(100);
            entity.Property(merchant => merchant.RiskLevel).IsRequired().HasMaxLength(30);
            entity.Property(merchant => merchant.CreatedAt).IsRequired();
            entity.HasIndex(merchant => merchant.Name);
            entity.HasOne(merchant => merchant.SettlementBankAccount)
                .WithMany()
                .HasForeignKey(merchant => merchant.SettlementBankAccountId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Prediction>(entity =>
        {
            entity.HasKey(prediction => prediction.Id);
            entity.Property(prediction => prediction.TransactionType).IsRequired().HasMaxLength(30);
            entity.Property(prediction => prediction.Amount).HasColumnType("decimal(18,2)");
            entity.Property(prediction => prediction.OldBalanceOrigin).HasColumnType("decimal(18,2)");
            entity.Property(prediction => prediction.NewBalanceOrigin).HasColumnType("decimal(18,2)");
            entity.Property(prediction => prediction.OldBalanceDestination).HasColumnType("decimal(18,2)");
            entity.Property(prediction => prediction.NewBalanceDestination).HasColumnType("decimal(18,2)");
            entity.Property(prediction => prediction.RiskLevel).IsRequired().HasMaxLength(30);
            entity.Property(prediction => prediction.Confidence).IsRequired();
            entity.Property(prediction => prediction.Explanation).IsRequired();
            entity.Property(prediction => prediction.SuggestedAction).IsRequired();
            entity.Property(prediction => prediction.CreatedAt).IsRequired();
            entity.HasOne(prediction => prediction.User)
                .WithMany()
                .HasForeignKey(prediction => prediction.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(prediction => prediction.Transaction)
                .WithMany(transaction => transaction.Predictions)
                .HasForeignKey(prediction => prediction.TransactionId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasIndex(prediction => prediction.UserId);
            entity.HasIndex(prediction => prediction.TransactionId);
            entity.HasIndex(prediction => prediction.CreatedAt);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(transaction => transaction.Id);
            entity.Property(transaction => transaction.Merchant).IsRequired().HasMaxLength(150);
            entity.Property(transaction => transaction.Category).IsRequired().HasMaxLength(100);
            entity.Property(transaction => transaction.Country).IsRequired().HasMaxLength(100);
            entity.Property(transaction => transaction.Amount).HasColumnType("decimal(18,2)");
            entity.Property(transaction => transaction.OldBalanceOrigin).HasColumnType("decimal(18,2)");
            entity.Property(transaction => transaction.NewBalanceOrigin).HasColumnType("decimal(18,2)");
            entity.Property(transaction => transaction.OldBalanceDestination).HasColumnType("decimal(18,2)");
            entity.Property(transaction => transaction.NewBalanceDestination).HasColumnType("decimal(18,2)");
            entity.Property(transaction => transaction.Currency).IsRequired().HasMaxLength(10);
            entity.Property(transaction => transaction.Status).IsRequired().HasMaxLength(20);
            entity.Property(transaction => transaction.ProcessingStatus).IsRequired().HasMaxLength(30);
            entity.Property(transaction => transaction.IdempotencyKey).HasMaxLength(100);
            entity.Property(transaction => transaction.TransactionType).IsRequired().HasMaxLength(30);
            entity.Property(transaction => transaction.Description).HasMaxLength(500);
            entity.Property(transaction => transaction.CreatedAt).IsRequired();
            entity.HasOne(transaction => transaction.User)
                .WithMany()
                .HasForeignKey(transaction => transaction.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(transaction => transaction.SourceBankAccount)
                .WithMany()
                .HasForeignKey(transaction => transaction.SourceBankAccountId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(transaction => transaction.Beneficiary)
                .WithMany()
                .HasForeignKey(transaction => transaction.BeneficiaryId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(transaction => transaction.MerchantRecord)
                .WithMany()
                .HasForeignKey(transaction => transaction.MerchantId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasIndex(transaction => transaction.UserId);
            entity.HasIndex(transaction => transaction.SourceBankAccountId);
            entity.HasIndex(transaction => transaction.BeneficiaryId);
            entity.HasIndex(transaction => transaction.MerchantId);
            entity.HasIndex(transaction => transaction.CreatedAt);
            entity.HasIndex(transaction => transaction.Status);
            entity.HasIndex(transaction => new { transaction.UserId, transaction.IdempotencyKey })
                .IsUnique()
                .HasFilter("[IdempotencyKey] IS NOT NULL");
        });

        // Demo banking data only. These are synthetic account numbers and IBANs with no live banking integration.
        modelBuilder.Entity<Bank>().HasData(
            new Bank { Id = 1, Name = "Raiffeisen Bank Kosovo", Country = "Kosovo", SwiftCode = "RBKODEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Bank { Id = 2, Name = "ProCredit Bank Kosovo", Country = "Kosovo", SwiftCode = "PCBKKDEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Bank { Id = 3, Name = "NLB Banka", Country = "Kosovo", SwiftCode = "NLBADEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Bank { Id = 4, Name = "TEB Bank", Country = "Kosovo", SwiftCode = "TEBKDEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Bank { Id = 5, Name = "BKT Kosovo", Country = "Kosovo", SwiftCode = "BKTKDEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Bank { Id = 6, Name = "Banka Ekonomike", Country = "Kosovo", SwiftCode = "BEKODEMO", IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) });

        modelBuilder.Entity<BankAccount>().HasData(
            new BankAccount { Id = 1, UserId = 1, BankId = 1, AccountNumber = "FGD-1000004821", IBAN = "XK051212000000004821", Currency = "EUR", CurrentBalance = 12850.45m, AccountType = "Checking", IsActive = true, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new BankAccount { Id = 2, UserId = 1, BankId = 2, AccountNumber = "FGD-1000007394", IBAN = "XK051212000000007394", Currency = "EUR", CurrentBalance = 5400.00m, AccountType = "Savings", IsActive = true, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new BankAccount { Id = 3, UserId = 2, BankId = 3, AccountNumber = "FGD-2000001188", IBAN = "XK051212000000001188", Currency = "EUR", CurrentBalance = 25000.00m, AccountType = "Operations", IsActive = true, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new BankAccount { Id = 4, UserId = 1, BankId = 4, AccountNumber = "FGD-1000006650", IBAN = "XK051212000000006650", Currency = "USD", CurrentBalance = 2400.25m, AccountType = "Travel", IsActive = false, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new BankAccount { Id = 5, UserId = 2, BankId = 5, AccountNumber = "FGD-MERCH-4102", IBAN = "XK051212000000014102", Currency = "EUR", CurrentBalance = 82000.00m, AccountType = "Merchant Settlement", IsActive = true, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) },
            new BankAccount { Id = 6, UserId = 2, BankId = 6, AccountNumber = "FGD-MERCH-9820", IBAN = "XK051212000000019820", Currency = "EUR", CurrentBalance = 64000.00m, AccountType = "Merchant Settlement", IsActive = true, CreatedAt = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc) });

        modelBuilder.Entity<Beneficiary>().HasData(
            new Beneficiary { Id = 1, UserId = 1, FullName = "Demo Family Transfer", BankId = 3, DestinationBankAccountId = 3, MaskedAccountReference = "•••• 1188", IsTrusted = true, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) },
            new Beneficiary { Id = 2, UserId = 1, FullName = "Demo Supplier Account", BankId = 6, DestinationBankAccountId = null, MaskedAccountReference = "•••• 7742", IsTrusted = false, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) });

        modelBuilder.Entity<Merchant>().HasData(
            new Merchant { Id = 1, Name = "Demo Market Prishtina", Category = "Retail", Country = "Kosovo", SettlementBankAccountId = 5, RiskLevel = "Low", IsActive = true, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) },
            new Merchant { Id = 2, Name = "Demo Travel Agency", Category = "Travel", Country = "Kosovo", SettlementBankAccountId = 6, RiskLevel = "Medium", IsActive = true, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) },
            new Merchant { Id = 3, Name = "Demo Electronics Store", Category = "E-Commerce", Country = "Kosovo", SettlementBankAccountId = 5, RiskLevel = "Low", IsActive = true, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) },
            new Merchant { Id = 4, Name = "Demo Crypto Exchange", Category = "Crypto", Country = "Kosovo", SettlementBankAccountId = 6, RiskLevel = "High", IsActive = true, CreatedAt = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc) });

        modelBuilder.Entity<FraudAlert>(entity =>
        {
            entity.HasKey(alert => alert.Id);
            entity.Property(alert => alert.Title).IsRequired().HasMaxLength(150);
            entity.Property(alert => alert.Severity).IsRequired().HasMaxLength(20);
            entity.Property(alert => alert.Status).IsRequired().HasMaxLength(20);
            entity.Property(alert => alert.CreatedAt).IsRequired();
            entity.HasOne(alert => alert.User)
                .WithMany()
                .HasForeignKey(alert => alert.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(alert => alert.Transaction)
                .WithMany()
                .HasForeignKey(alert => alert.TransactionId)
                .OnDelete(DeleteBehavior.NoAction)
                .IsRequired(false);
            entity.HasOne(alert => alert.Prediction)
                .WithMany()
                .HasForeignKey(alert => alert.PredictionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(alert => alert.UserId);
            entity.HasIndex(alert => alert.TransactionId);
            entity.HasIndex(alert => alert.Status);
            entity.HasIndex(alert => new { alert.TransactionId, alert.Status });
        });

        modelBuilder.Entity<SystemLog>(entity =>
        {
            entity.HasKey(log => log.Id);
            entity.Property(log => log.Level).IsRequired().HasMaxLength(20);
            entity.Property(log => log.Source).IsRequired().HasMaxLength(30);
            entity.Property(log => log.Message).IsRequired().HasMaxLength(500);
            entity.Property(log => log.UserName).HasMaxLength(150);
            entity.Property(log => log.Method).HasMaxLength(20);
            entity.Property(log => log.Path).HasMaxLength(300);
            entity.Property(log => log.IpAddress).HasMaxLength(80);
            entity.Property(log => log.CreatedAt).IsRequired();
            entity.HasIndex(log => log.CreatedAt);
            entity.HasIndex(log => log.Level);
            entity.HasIndex(log => log.Source);
            entity.HasIndex(log => log.UserId);
        });

        modelBuilder.Entity<Transaction>().HasData(
            new Transaction
            {
                Id = 1,
                UserId = 1,
                Merchant = "Amazon",
                Category = "Retail",
                Country = "United States",
                Amount = 129.99m,
                Currency = "USD",
                RiskScore = 18,
                Status = "safe",
                ProcessingStatus = "Completed",
                TransactionType = "PAYMENT",
                CreatedAt = new DateTime(2026, 1, 2, 10, 15, 0, DateTimeKind.Utc),
                Description = "Office equipment purchase"
            },
            new Transaction
            {
                Id = 2,
                UserId = 1,
                Merchant = "QuickCash Transfer",
                Category = "Money Transfer",
                Country = "Nigeria",
                Amount = 4250m,
                Currency = "USD",
                RiskScore = 78,
                Status = "fraud",
                ProcessingStatus = "Rejected",
                TransactionType = "TRANSFER",
                CreatedAt = new DateTime(2026, 1, 3, 2, 35, 0, DateTimeKind.Utc),
                Description = "High-value transfer to new destination"
            },
            new Transaction
            {
                Id = 3,
                UserId = 2,
                Merchant = "Booking",
                Category = "Travel",
                Country = "Germany",
                Amount = 860m,
                Currency = "USD",
                RiskScore = 44,
                Status = "review",
                ProcessingStatus = "PendingReview",
                TransactionType = "PAYMENT",
                CreatedAt = new DateTime(2026, 1, 4, 18, 20, 0, DateTimeKind.Utc),
                Description = "Travel booking flagged for review"
            });

        modelBuilder.Entity<FraudCase>(entity =>
        {
            entity.HasKey(fraudCase => fraudCase.Id);
            entity.Property(fraudCase => fraudCase.Status).IsRequired().HasMaxLength(30);
            entity.Property(fraudCase => fraudCase.Priority).IsRequired().HasMaxLength(20);
            entity.Property(fraudCase => fraudCase.ModelDecision).IsRequired().HasMaxLength(30);
            entity.Property(fraudCase => fraudCase.FinalDecision).HasMaxLength(30);
            entity.Property(fraudCase => fraudCase.AnalystComment).HasMaxLength(2000);
            entity.Property(fraudCase => fraudCase.CreatedAt).IsRequired();
            entity.HasOne(fraudCase => fraudCase.Transaction)
                .WithMany()
                .HasForeignKey(fraudCase => fraudCase.TransactionId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(fraudCase => fraudCase.Prediction)
                .WithMany()
                .HasForeignKey(fraudCase => fraudCase.PredictionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(fraudCase => fraudCase.FraudAlert)
                .WithMany()
                .HasForeignKey(fraudCase => fraudCase.FraudAlertId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(fraudCase => fraudCase.AssignedAnalyst)
                .WithMany()
                .HasForeignKey(fraudCase => fraudCase.AssignedAnalystId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasIndex(fraudCase => fraudCase.TransactionId).IsUnique();
            entity.HasIndex(fraudCase => fraudCase.AssignedAnalystId);
            entity.HasIndex(fraudCase => fraudCase.Status);
            entity.HasIndex(fraudCase => fraudCase.Priority);
            entity.HasIndex(fraudCase => fraudCase.CreatedAt);
        });
    }
}
