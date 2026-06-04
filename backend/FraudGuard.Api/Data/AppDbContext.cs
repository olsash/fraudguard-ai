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
            entity.Property(prediction => prediction.Explanation).IsRequired();
            entity.Property(prediction => prediction.SuggestedAction).IsRequired();
            entity.Property(prediction => prediction.CreatedAt).IsRequired();
            entity.HasOne(prediction => prediction.User)
                .WithMany()
                .HasForeignKey(prediction => prediction.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(prediction => prediction.UserId);
            entity.HasIndex(prediction => prediction.CreatedAt);
        });
    }
}
