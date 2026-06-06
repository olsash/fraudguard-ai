using FraudGuard.Api.Models;
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
                Role = "User",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new User
            {
                Id = 2,
                FullName = "Credit Admin",
                Email = "admin@credit.com",
                PasswordHash = "$2a$11$hMS2w0HZwNwlHWet4HN1Ce.tzShAq1G7pJ30aYBQawVUxjn3a.IJC",
                Role = "Admin",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
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
            entity.Property(transaction => transaction.Currency).IsRequired().HasMaxLength(10);
            entity.Property(transaction => transaction.Status).IsRequired().HasMaxLength(20);
            entity.Property(transaction => transaction.TransactionType).IsRequired().HasMaxLength(30);
            entity.Property(transaction => transaction.Description).HasMaxLength(500);
            entity.Property(transaction => transaction.CreatedAt).IsRequired();
            entity.HasOne(transaction => transaction.User)
                .WithMany()
                .HasForeignKey(transaction => transaction.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(transaction => transaction.UserId);
            entity.HasIndex(transaction => transaction.CreatedAt);
            entity.HasIndex(transaction => transaction.Status);
        });

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
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(alert => alert.Prediction)
                .WithMany()
                .HasForeignKey(alert => alert.PredictionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(alert => alert.UserId);
            entity.HasIndex(alert => alert.TransactionId);
            entity.HasIndex(alert => alert.Status);
            entity.HasIndex(alert => new { alert.TransactionId, alert.Status });
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
                TransactionType = "PAYMENT",
                CreatedAt = new DateTime(2026, 1, 4, 18, 20, 0, DateTimeKind.Utc),
                Description = "Travel booking flagged for review"
            });
    }
}
