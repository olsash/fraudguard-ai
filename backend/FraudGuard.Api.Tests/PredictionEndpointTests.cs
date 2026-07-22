using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Encodings.Web;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace FraudGuard.Api.Tests;

public class PredictionEndpointTests : IClassFixture<PredictionApiFactory>
{
    private readonly HttpClient _client;
    private readonly PredictionApiFactory _factory;

    public PredictionEndpointTests(PredictionApiFactory factory)
    {
        _factory = factory;
        _factory.ResetDatabase();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreatePrediction_WithSafeTransaction_ReturnsLowRiskPrediction()
    {
        var response = await _client.PostAsJsonAsync("/api/predictions", SafePredictionRequest());

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PredictionResponseBody>();

        Assert.NotNull(body);
        Assert.False(body.IsFraud);
        Assert.Equal("Not fraud", body.PredictedClass);
        Assert.Equal("Low", body.RiskLevel);
        Assert.InRange(body.FraudProbability, 0, 0.2);
        Assert.InRange(body.RiskScore, 0, 20);
        Assert.Equal("RandomForestClassifier", body.ModelName);
        Assert.False(string.IsNullOrWhiteSpace(body.ModelVersion));
        Assert.Contains(body.RiskBreakdown, factor => factor.Factor == "Transaction amount");
    }

    [Fact]
    public async Task CreatePrediction_WithSuspiciousTransaction_ReturnsFraudPrediction()
    {
        var response = await _client.PostAsJsonAsync("/api/predictions", SuspiciousPredictionRequest());

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PredictionResponseBody>();

        Assert.NotNull(body);
        Assert.True(body.IsFraud);
        Assert.Equal("Fraud", body.PredictedClass);
        Assert.Equal("High", body.RiskLevel);
        Assert.InRange(body.FraudProbability, 0.9, 1.0);
        Assert.InRange(body.RiskScore, 90, 100);
        Assert.Equal("RandomForestClassifier", body.ModelName);
        Assert.Contains(body.RiskBreakdown, factor => factor.Factor == "High transaction amount");
        Assert.Contains(body.RiskBreakdown, factor => factor.Factor == "Transfer or cash-out transaction type");
    }

    [Fact]
    public async Task CreatePrediction_WorksWithoutFastApiPort8000()
    {
        var response = await _client.PostAsJsonAsync("/api/predictions", SuspiciousPredictionRequest());

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PredictionResponseBody>();

        Assert.NotNull(body);
        Assert.True(body.IsFraud);
        Assert.DoesNotContain(body.Reasons, reason => reason.Contains("FastAPI", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(body.Reasons, reason => reason.Contains("port 8000", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task CreatePrediction_WithMissingAmount_ReturnsClearValidationError()
    {
        var request = SuspiciousPredictionRequest();
        request.Remove("amount");

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, "Amount is required.");
    }

    [Fact]
    public async Task CreatePrediction_WithNegativeAmount_ReturnsClearValidationError()
    {
        var request = SuspiciousPredictionRequest();
        request["amount"] = -1;

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, "Amount must be numeric and non-negative.");
    }

    [Fact]
    public async Task CreatePrediction_WithInvalidTransactionType_ReturnsClearError()
    {
        var request = SuspiciousPredictionRequest();
        request["transactionType"] = "WIRE";

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Transaction type must be one of CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER.", body?.Message);
    }

    [Theory]
    [InlineData("oldBalanceOrigin", "Old origin balance is required.")]
    [InlineData("newBalanceOrigin", "New origin balance is required.")]
    [InlineData("oldBalanceDestination", "Old destination balance is required.")]
    [InlineData("newBalanceDestination", "New destination balance is required.")]
    public async Task CreatePrediction_WithMissingBalanceValue_ReturnsClearValidationError(string missingField, string expectedMessage)
    {
        var request = SuspiciousPredictionRequest();
        request.Remove(missingField);

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, expectedMessage);
    }

    [Fact]
    public async Task PredictTransaction_WithMissingBalances_ReturnsValidationAndKeepsNullBalances()
    {
        var transactionId = await CreateStoredTransactionAsync(2500m, "TRANSFER");

        var response = await _client.PostAsJsonAsync($"/api/predictions/predict-transaction/{transactionId}", new { });

        await AssertValidationError(response, "Old Balance Origin is required before analyzing a stored transaction.");
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == transactionId);
        Assert.Null(transaction.OldBalanceOrigin);
        Assert.Null(transaction.NewBalanceOrigin);
        Assert.Null(transaction.OldBalanceDestination);
        Assert.Null(transaction.NewBalanceDestination);
        Assert.Empty(transaction.Predictions);
    }

    [Fact]
    public async Task PredictTransaction_WithProvidedBalances_SavesPredictionAndUpdatesTransaction()
    {
        var transactionId = await CreateStoredTransactionAsync(1000000m, "CASH_OUT");
        var balances = StoredBalanceRequest();

        var response = await _client.PostAsJsonAsync($"/api/predictions/predict-transaction/{transactionId}", balances);

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TransactionPredictionResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("fraud", body.Status);
        Assert.Contains(body.Explanation, reason => reason.Contains("Origin balance changed from 1,000,000.00 to 0.00", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(body.Explanation, reason => reason.Contains("derived", StringComparison.OrdinalIgnoreCase));

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == transactionId);
        var prediction = Assert.Single(transaction.Predictions);
        Assert.Equal(1000000m, transaction.OldBalanceOrigin);
        Assert.Equal(0m, transaction.NewBalanceOrigin);
        Assert.Equal(0m, transaction.OldBalanceDestination);
        Assert.Equal(1000000m, transaction.NewBalanceDestination);
        Assert.Equal(transaction.OldBalanceOrigin, prediction.OldBalanceOrigin);
        Assert.Equal(transaction.NewBalanceOrigin, prediction.NewBalanceOrigin);
        Assert.Equal(transaction.OldBalanceDestination, prediction.OldBalanceDestination);
        Assert.Equal(transaction.NewBalanceDestination, prediction.NewBalanceDestination);
    }

    [Fact]
    public async Task PredictTransaction_ReusesStoredBalancesOnFutureAnalyze()
    {
        var transactionId = await CreateStoredTransactionAsync(1000000m, "CASH_OUT");
        var balances = StoredBalanceRequest();

        var first = await _client.PostAsJsonAsync($"/api/predictions/predict-transaction/{transactionId}", balances);
        first.EnsureSuccessStatusCode();
        var second = await _client.PostAsJsonAsync($"/api/predictions/predict-transaction/{transactionId}", new { });
        second.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var predictions = await dbContext.Predictions
            .Where(item => item.TransactionId == transactionId)
            .OrderBy(item => item.Id)
            .ToListAsync();

        Assert.Equal(2, predictions.Count);
        Assert.All(predictions, prediction =>
        {
            Assert.Equal(1000000m, prediction.OldBalanceOrigin);
            Assert.Equal(0m, prediction.NewBalanceOrigin);
            Assert.Equal(0m, prediction.OldBalanceDestination);
            Assert.Equal(1000000m, prediction.NewBalanceDestination);
        });
    }

    [Fact]
    public async Task PredictionHistory_ForLegacyPredictionWithoutTransactionBalances_UsesNeutralBalanceBreakdown()
    {
        var transactionId = await CreateStoredTransactionAsync(1000m, "TRANSFER");
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.Predictions.Add(new Prediction
            {
                UserId = 99,
                TransactionId = transactionId,
                TransactionType = "TRANSFER",
                Amount = 1000m,
                OldBalanceOrigin = 0m,
                NewBalanceOrigin = 0m,
                OldBalanceDestination = 0m,
                NewBalanceDestination = 0m,
                RiskScore = 45,
                RiskLevel = "Medium",
                IsFraud = false,
                Confidence = 0.78,
                Explanation = "[]",
                SuggestedAction = "Manual verification recommended",
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/predictions/my");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PredictionResponseBody[]>();
        var prediction = Assert.Single(body!, item => item.TransactionId == transactionId);
        var factor = Assert.Single(prediction.RiskBreakdown);
        Assert.Equal("Neutral", factor.Impact);
        Assert.Contains("Balance data was not provided", factor.Explanation);
        Assert.DoesNotContain(prediction.RiskBreakdown, item => item.Explanation.Contains("Origin balance did not decrease", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("FraudAnalyst")]
    [InlineData("fraudanalyst")]
    [InlineData("fraudAnalyst")]
    [InlineData("fraud analyst")]
    public void ApplicationRoles_NormalizesFraudAnalystVariants(string role)
    {
        Assert.Equal(ApplicationRoles.FraudAnalyst, ApplicationRoles.Normalize(role));
    }

    [Fact]
    public void JwtTokenService_AddsNormalizedFraudAnalystRoleClaim()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "fraudguard-test-secret-with-enough-length",
                ["Jwt:Issuer"] = "FraudGuard.Tests",
                ["Jwt:Audience"] = "FraudGuard.Tests",
                ["Jwt:ExpiresInMinutes"] = "30"
            })
            .Build();
        var service = new JwtTokenService(configuration);

        var token = service.CreateToken(new User
        {
            Id = 501,
            FullName = "Analyst User",
            Email = "analyst-jwt@example.com",
            PasswordHash = "unused",
            Role = "fraudanalyst",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Contains(jwt.Claims, claim =>
            claim.Type == ClaimTypes.Role && claim.Value == ApplicationRoles.FraudAnalyst);
    }

    [Fact]
    public async Task DevelopmentSeeder_CreatesFraudAnalystAccountWithoutBankAccounts()
    {
        await using var provider = CreateSeederProvider();
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.EnsureCreated();

        await DevelopmentDemoUserSeeder.SeedAsync(dbContext, scope.ServiceProvider.GetRequiredService<ILogger<Program>>());

        dbContext.ChangeTracker.Clear();
        var analyst = await dbContext.Users.SingleOrDefaultAsync(user => user.Email == "analyst@fraudguard.com");

        Assert.NotNull(analyst);
        Assert.Equal("Fraud Analyst", analyst.FullName);
        Assert.Equal(ApplicationRoles.FraudAnalyst, analyst.Role);
        Assert.True(analyst.IsActive);
        Assert.True(BCrypt.Net.BCrypt.Verify("analyst123", analyst.PasswordHash));
        Assert.False(await dbContext.BankAccounts.AnyAsync(account => account.UserId == analyst.Id));
    }

    [Fact]
    public async Task DevelopmentSeeder_MigratesOnlyCreditDemoDomainAndSkipsCollisions()
    {
        await using var provider = CreateSeederProvider();
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.EnsureCreated();
        dbContext.Users.AddRange(
            new User
            {
                FullName = "Legacy Demo",
                Email = "legacy@credit.com",
                PasswordHash = "unused",
                Role = ApplicationRoles.User,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new User
            {
                FullName = "Collision Old",
                Email = "collision@credit.com",
                PasswordHash = "unused",
                Role = ApplicationRoles.User,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new User
            {
                FullName = "Collision Current",
                Email = "collision@fraudguard.com",
                PasswordHash = "unused",
                Role = ApplicationRoles.User,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new User
            {
                FullName = "External Address",
                Email = "person@gmail.com",
                PasswordHash = "unused",
                Role = ApplicationRoles.User,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        await DevelopmentDemoUserSeeder.SeedAsync(dbContext, scope.ServiceProvider.GetRequiredService<ILogger<Program>>());

        dbContext.ChangeTracker.Clear();
        var users = await dbContext.Users.ToListAsync();
        Assert.Contains(users, user => user.Email == "legacy@fraudguard.com");
        Assert.Contains(users, user => user.Email == "collision@credit.com");
        Assert.Contains(users, user => user.Email == "collision@fraudguard.com");
        Assert.Contains(users, user => user.Email == "person@gmail.com");
    }

    [Fact]
    public async Task AdminUsers_AllowsAdminToCreateFraudAnalyst()
    {
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);
        var email = $"analyst-{Guid.NewGuid():N}@example.com";

        var response = await adminClient.PostAsJsonAsync("/api/admin/users", new
        {
            fullName = "Created Fraud Analyst",
            email,
            password = "analyst123",
            role = "fraudAnalyst"
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AdminUserResponseBody>();
        Assert.Equal(ApplicationRoles.FraudAnalyst, body?.Role);
    }

    [Fact]
    public async Task AdminUsers_AllowsAdminToChangeUserToFraudAnalyst()
    {
        var userId = await CreateUserAsync(ApplicationRoles.User);
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);

        var response = await adminClient.PutAsJsonAsync($"/api/admin/users/{userId}", new
        {
            fullName = "Converted User",
            email = $"converted-{Guid.NewGuid():N}@example.com",
            phoneNumber = (string?)null,
            role = ApplicationRoles.FraudAnalyst,
            status = "Active"
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AdminUserResponseBody>();
        Assert.Equal(ApplicationRoles.FraudAnalyst, body?.Role);
    }

    [Fact]
    public async Task AdminUsers_PreventsCurrentAdminFromRemovingOwnAdminRole()
    {
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);

        var response = await adminClient.PutAsJsonAsync("/api/admin/users/100", new
        {
            fullName = "Prediction Test Admin",
            email = "prediction-admin@example.com",
            phoneNumber = (string?)null,
            role = ApplicationRoles.FraudAnalyst,
            status = "Active"
        });

        await AssertValidationError(response, "You cannot remove your own Admin role.");
    }

    [Fact]
    public async Task FraudAnalyst_CannotAccessAdminUserManagement()
    {
        var analystClient = _factory.CreateClient();
        analystClient.DefaultRequestHeaders.Add("X-Test-User-Id", "101");
        analystClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.FraudAnalyst);

        var response = await analystClient.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task FraudAnalyst_CanAccessAnalystScopedPredictionEndpointOnly()
    {
        var analystClient = _factory.CreateClient();
        analystClient.DefaultRequestHeaders.Add("X-Test-User-Id", "101");
        analystClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.FraudAnalyst);

        var adminResponse = await analystClient.GetAsync("/api/admin/transactions");
        var analystResponse = await analystClient.GetAsync("/api/analyst/predictions");

        Assert.Equal(HttpStatusCode.Forbidden, adminResponse.StatusCode);
        analystResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task FraudAnalyst_CanAccessScopedAnalystTransactions()
    {
        await CreateReviewCaseAsync(assignedAnalystId: 101);
        var analystClient = _factory.CreateClient();
        analystClient.DefaultRequestHeaders.Add("X-Test-User-Id", "101");
        analystClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.FraudAnalyst);

        var response = await analystClient.GetAsync("/api/analyst/transactions?scope=mine");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AnalystTransactionListResponseBody>();
        Assert.NotNull(body);
        Assert.Single(body.Items);
        Assert.Equal(1, body.Summary.TotalTransactions);
        Assert.Equal("TX-", body.Items[0].TransactionReference[..3]);
    }

    [Fact]
    public async Task User_CannotAccessAnalystTransactions()
    {
        var response = await _client.GetAsync("/api/analyst/transactions");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminUsers_DeleteUserWithHistoryReturnsConflict()
    {
        var userId = await CreateUserAsync(ApplicationRoles.User);
        await CreateStoredTransactionForUserAsync(userId);
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);

        var response = await adminClient.DeleteAsync($"/api/admin/users/{userId}");
        var body = await response.Content.ReadFromJsonAsync<ErrorResponse>();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("This user has financial or investigation history and cannot be permanently deleted. Deactivate the account instead.", body?.Message);
    }

    [Fact]
    public async Task Banks_ReturnsActiveDemoBankList()
    {
        var response = await _client.GetAsync("/api/banks");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankResponseBody[]>();
        Assert.NotNull(body);
        Assert.Contains(body, bank => bank.Name == "Raiffeisen Bank Kosovo");
        Assert.Contains(body, bank => bank.Name == "ProCredit Bank Kosovo");
        Assert.Contains(body, bank => bank.Name == "NLB Banka");
        Assert.Contains(body, bank => bank.Name == "TEB Bank");
        Assert.Contains(body, bank => bank.Name == "BKT Kosovo");
        Assert.Contains(body, bank => bank.Name == "Banka Ekonomike");
    }

    [Fact]
    public async Task AdminMerchants_AllowsAdminToCreateMerchantAndSettlementAccount()
    {
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);
        var code = $"TEST-{Guid.NewGuid():N}"[..20].ToUpperInvariant();

        var response = await adminClient.PostAsJsonAsync("/api/admin/merchants", new
        {
            name = "Test Merchant",
            merchantCode = code,
            category = "Retail",
            merchantCategoryCode = "5311",
            country = "Kosovo",
            bankId = 1,
            riskLevel = "Low",
            isVerified = true,
            isActive = true
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AdminMerchantDto>();
        Assert.NotNull(body);
        Assert.Equal(code, body.MerchantCode);
        Assert.NotNull(body.MaskedSettlementAccount);
        Assert.NotNull(body.MaskedSettlementIban);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var merchant = await dbContext.Merchants.Include(item => item.SettlementBankAccount).FirstAsync(item => item.MerchantCode == code);
        Assert.NotNull(merchant.SettlementBankAccount);
        Assert.Equal(0m, merchant.SettlementBankAccount.CurrentBalance);
    }

    [Fact]
    public async Task AdminMerchants_RejectsNonAdminManagement()
    {
        var response = await _client.PostAsJsonAsync("/api/admin/merchants", new
        {
            name = "User Merchant",
            merchantCode = "USER-MERCHANT",
            category = "Retail",
            country = "Kosovo",
            bankId = 1,
            riskLevel = "Low",
            isVerified = true,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AdminMerchants_RequiresUniqueMerchantCode()
    {
        var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-Test-User-Id", "100");
        adminClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.Admin);

        var response = await adminClient.PostAsJsonAsync("/api/admin/merchants", new
        {
            name = "Duplicate Merchant",
            merchantCode = "VIVA-FRESH",
            category = "Retail",
            country = "Kosovo",
            bankId = 1,
            riskLevel = "Low",
            isVerified = true,
            isActive = true
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ActiveMerchants_ReturnsOnlyActiveVerifiedSafeFields()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.Merchants.Add(new Merchant
            {
                Name = "Hidden Merchant",
                MerchantCode = "HIDDEN-MERCHANT",
                Category = "Retail",
                Country = "Kosovo",
                BankId = 1,
                RiskLevel = "Low",
                IsVerified = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }

        var response = await _client.GetAsync("/api/merchants/active");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<MerchantDto[]>();
        Assert.NotNull(body);
        Assert.Contains(body, merchant => merchant.MerchantCode == "VIVA-FRESH");
        Assert.DoesNotContain(body, merchant => merchant.MerchantCode == "HIDDEN-MERCHANT");
        Assert.DoesNotContain(await response.Content.ReadAsStringAsync(), "XK05MERCH", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MerchantDevelopmentSeeder_IsIdempotentAndUsesGeneratedSettlementAccountIds()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await MerchantDevelopmentSeeder.SeedAsync(dbContext, NullLogger.Instance);
        await MerchantDevelopmentSeeder.SeedAsync(dbContext, NullLogger.Instance);

        var merchants = await dbContext.Merchants.Include(item => item.SettlementBankAccount).ToListAsync();
        Assert.Equal(6, merchants.Count(item => item.MerchantCode is "VIVA-FRESH" or "ALBI-MALL" or "GJIRAFA50" or "MERIDIAN-EXP" or "KOSOVO-ENERGY" or "DUKAGJINI-BOOKS"));
        Assert.All(merchants.Where(item => item.MerchantCode is "VIVA-FRESH" or "ALBI-MALL" or "GJIRAFA50" or "MERIDIAN-EXP" or "KOSOVO-ENERGY" or "DUKAGJINI-BOOKS"), merchant =>
        {
            Assert.NotNull(merchant.SettlementBankAccount);
            Assert.Equal(merchant.Id, merchant.SettlementBankAccount!.MerchantId);
            Assert.Null(merchant.SettlementBankAccount.UserId);
        });

        Assert.Equal(6, await dbContext.BankAccounts.CountAsync(account => account.AccountType == "Merchant Settlement"));
    }

    [Fact]
    public async Task MerchantDevelopmentSeeder_DoesNotOverwriteExistingUserAccountsWithIdsSevenToTen()
    {
        await using var provider = CreateSeederProvider();
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.EnsureCreated();
        dbContext.BankAccounts.AddRange(
            new BankAccount { Id = 7, UserId = 1, BankId = 1, AccountName = "Existing User 7", AccountHolderName = "Existing User", AccountNumber = "USER-0007", IBAN = "XK05USER000000000007", Currency = "EUR", CurrentBalance = 700m, AccountType = "Current", IsActive = true, CreatedAt = DateTime.UtcNow },
            new BankAccount { Id = 8, UserId = 1, BankId = 1, AccountName = "Existing User 8", AccountHolderName = "Existing User", AccountNumber = "USER-0008", IBAN = "XK05USER000000000008", Currency = "EUR", CurrentBalance = 800m, AccountType = "Current", IsActive = true, CreatedAt = DateTime.UtcNow },
            new BankAccount { Id = 9, UserId = 1, BankId = 1, AccountName = "Existing User 9", AccountHolderName = "Existing User", AccountNumber = "USER-0009", IBAN = "XK05USER000000000009", Currency = "EUR", CurrentBalance = 900m, AccountType = "Current", IsActive = true, CreatedAt = DateTime.UtcNow },
            new BankAccount { Id = 10, UserId = 1, BankId = 1, AccountName = "Existing User 10", AccountHolderName = "Existing User", AccountNumber = "USER-0010", IBAN = "XK05USER000000000010", Currency = "EUR", CurrentBalance = 1000m, AccountType = "Current", IsActive = true, CreatedAt = DateTime.UtcNow });
        await dbContext.SaveChangesAsync();

        await MerchantDevelopmentSeeder.SeedAsync(dbContext, NullLogger.Instance);

        var preserved = await dbContext.BankAccounts.Where(account => account.Id >= 7 && account.Id <= 10).OrderBy(account => account.Id).ToListAsync();
        Assert.Equal([700m, 800m, 900m, 1000m], preserved.Select(account => account.CurrentBalance).ToArray());
        Assert.All(preserved, account =>
        {
            Assert.Equal(1, account.UserId);
            Assert.Null(account.MerchantId);
            Assert.StartsWith("USER-", account.AccountNumber);
        });

        var settlementAccounts = await dbContext.BankAccounts.Where(account => account.AccountType == "Merchant Settlement").ToListAsync();
        Assert.Equal(6, settlementAccounts.Count);
        Assert.DoesNotContain(settlementAccounts, account => account.Id is >= 7 and <= 10);
    }

    [Fact]
    public async Task PaymentRejectsBeneficiaryAndTransferRejectsMerchant()
    {
        var accountId = await CreateDemoAccountAsync(5000m);
        var client = CreateUserOneClient();

        var payment = await client.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            merchantId = 1,
            amount = 25m,
            currency = "EUR",
            transactionType = "PAYMENT"
        });
        await AssertValidationError(payment, "Payment transactions must not include a beneficiary.");

        var transfer = await client.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            merchantId = 1,
            amount = 25m,
            currency = "EUR",
            transactionType = "TRANSFER"
        });
        await AssertValidationError(transfer, "Transfer transactions must not include a merchant.");
    }

    [Fact]
    public async Task BankAccounts_CorrectDetailsLinkSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal(1, body.BankId);
        Assert.Equal("Raiffeisen Bank Kosovo", body.BankName);
        Assert.Equal("Fiona Ajeti", body.AccountHolderName);
        Assert.Equal("Current", body.AccountType);
        Assert.Equal("EUR", body.Currency);
        Assert.Equal(5000m, body.CurrentBalance);
        Assert.StartsWith("•••• ", body.MaskedAccountNumber);
        Assert.StartsWith("XK05", body.MaskedIban);
        Assert.Contains("••••", body.MaskedIban);
    }

    [Fact]
    public async Task BankAccounts_SavingsAccountLinksSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(2, "Arben Krasniqi", "2000123456", "XK052234567890123456", "314159"));

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("Savings", body.AccountType);
        Assert.Equal(10000m, body.CurrentBalance);
    }

    [Fact]
    public async Task BankAccounts_AccountNumberWithSpacesIsNormalizedSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(accountNumber: "1000 123456"));

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("•••• 3456", body.MaskedAccountNumber);
    }

    [Fact]
    public async Task BankAccounts_AccountNumberWithHyphenIsNormalizedSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(accountNumber: "1000-123456"));

        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task BankAccounts_LowercaseAndSpacedIbanIsNormalizedSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(3, "Fiona Ajeti", "3100 102157", "xk05 3100 1021 5700 0001", "482193"));

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal(3, body.BankId);
        Assert.Equal("NLB Banka", body.BankName);
        Assert.Equal("Fiona Ajeti", body.AccountHolderName);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("12A456")]
    public async Task BankAccounts_InvalidVerificationCodeFormatIsRejected(string verificationCode)
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var request = DemoConnectRequest();
        request["verificationCode"] = verificationCode;

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", request);

        await AssertValidationError(response, "Verification code must contain exactly 6 digits.");
    }

    [Fact]
    public async Task BankAccounts_ValidSeededFionaAjetiNlbCredentialsConnectSuccessfully()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(3, "  Fiona   Ajeti  ", "3100 102157", "XK05-3100-1021-5700-0001", "482193"));

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("NLB Banka", body.BankName);
        Assert.Equal("Fiona Ajeti", body.AccountHolderName);
        Assert.Equal(8300m, body.CurrentBalance);
    }

    [Fact]
    public async Task BankAccounts_RandomCredentialsAreRejected()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(1, "Random User", "9999999999", "XK059999999999999999", "999999"));

        await AssertValidationError(response, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_IncorrectVerificationCodeIsRejected()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var request = DemoConnectRequest();
        request["verificationCode"] = "000000";

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", request);

        await AssertValidationError(response, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_IncorrectIbanOrAccountNumberIsRejected()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var badIban = DemoConnectRequest();
        badIban["iban"] = "XK051234567890129999";
        var ibanResponse = await client.PostAsJsonAsync("/api/bank-accounts/connect", badIban);
        await AssertValidationError(ibanResponse, "The bank account details could not be verified.");

        var badAccount = DemoConnectRequest();
        badAccount["accountNumber"] = "1000999999";
        var accountResponse = await client.PostAsJsonAsync("/api/bank-accounts/connect", badAccount);
        await AssertValidationError(accountResponse, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_InactiveOrMissingBankCannotBeVerified()
    {
        var inactiveBankId = await CreateInactiveBankAsync();
        var (client, _) = await CreateNormalUserClientAsync();

        var inactiveResponse = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(inactiveBankId, "Fiona Ajeti", "1000123456", "XK051234567890123456", "482193"));
        await AssertValidationError(inactiveResponse, "The bank account details could not be verified.");

        var missingResponse = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(999999, "Fiona Ajeti", "1000123456", "XK051234567890123456", "482193"));
        await AssertValidationError(missingResponse, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_IgnoresSubmittedBalanceAndUserId()
    {
        var (client, userId) = await CreateNormalUserClientAsync();
        var request = DemoConnectRequest(3, "Lira Gashi", "3000123456", "XK053234567890123456", "271828");
        request["userId"] = 100;
        request["currentBalance"] = 999999m;
        request["oldBalanceOrigin"] = 1;
        request["newBalanceOrigin"] = 2;

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", request);

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<BankAccountResponseBody>();
        Assert.NotNull(body);
        Assert.Equal(7200m, body.CurrentBalance);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == body.Id);
        Assert.Equal(userId, account.UserId);
        Assert.Equal(7200m, account.CurrentBalance);
    }

    [Theory]
    [InlineData("100", ApplicationRoles.Admin)]
    [InlineData("101", ApplicationRoles.FraudAnalyst)]
    public async Task BankAccounts_AdminAndFraudAnalystCannotConnectPersonalAccounts(string userId, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User-Id", userId);
        client.DefaultRequestHeaders.Add("X-Test-Role", role);

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task BankAccounts_UserCannotExceedThreeActiveAccounts()
    {
        var (client, userId) = await CreateNormalUserClientAsync();
        await CreateAccountForUserAsync(userId, 1, "Current");
        await CreateAccountForUserAsync(userId, 2, "Current");
        await CreateAccountForUserAsync(userId, 3, "Current");

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(4, "Dardan Berisha", "4000123456", "XK054234567890123456", "739204"));

        await AssertValidationError(response, "maximum of 3 connected accounts");
    }

    [Fact]
    public async Task BankAccounts_CannotBeLinkedTwice()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var first = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());
        first.EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());

        await AssertValidationError(response, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_CannotBeLinkedToTwoDifferentUsers()
    {
        var (firstClient, _) = await CreateNormalUserClientAsync();
        var (secondClient, _) = await CreateNormalUserClientAsync();
        var first = await firstClient.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());
        first.EnsureSuccessStatusCode();

        var response = await secondClient.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());

        await AssertValidationError(response, "The bank account details could not be verified.");
    }

    [Fact]
    public async Task BankAccounts_ReturnsOnlyMaskedLinkedAccountsForCurrentUser()
    {
        var (client, userId) = await CreateNormalUserClientAsync();
        var (otherClient, _) = await CreateNormalUserClientAsync();
        var first = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(5, "Elira Morina", "5000123456", "XK055234567890123456", "615243"));
        var second = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(6, "Besnik Hoxha", "6000123456", "XK056234567890123456", "908172"));
        var other = await otherClient.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(2, "Arben Krasniqi", "2000123456", "XK052234567890123456", "314159"));
        first.EnsureSuccessStatusCode();
        second.EnsureSuccessStatusCode();
        other.EnsureSuccessStatusCode();

        var list = await client.GetAsync("/api/bank-accounts/my");
        list.EnsureSuccessStatusCode();
        var body = await list.Content.ReadFromJsonAsync<BankAccountResponseBody[]>();
        Assert.NotNull(body);
        Assert.Equal(2, body.Length);
        Assert.All(body, account =>
        {
            Assert.Contains("••••", account.MaskedAccountNumber);
            Assert.Contains("••••", account.MaskedIban);
            Assert.DoesNotContain("5000123456", account.MaskedAccountNumber);
            Assert.DoesNotContain("XK055234567890123456", account.MaskedIban);
        });

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rawAccounts = await dbContext.BankAccounts
            .Where(item => item.UserId == userId)
            .Select(item => new { item.AccountNumber, item.IBAN })
            .ToListAsync();
        Assert.Equal(rawAccounts.Count, rawAccounts.Select(item => item.AccountNumber).Distinct().Count());
        Assert.Equal(rawAccounts.Count, rawAccounts.Select(item => item.IBAN).Distinct().Count());
    }

    [Fact]
    public async Task BankAccounts_VerificationCodesAndHashesAreNotReturnedByAccountApis()
    {
        var (client, _) = await CreateNormalUserClientAsync();

        var connect = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest());
        connect.EnsureSuccessStatusCode();
        var connectJson = await connect.Content.ReadAsStringAsync();
        Assert.DoesNotContain("verificationCode", connectJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("verificationCodeHash", connectJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("482193", connectJson, StringComparison.OrdinalIgnoreCase);

        var list = await client.GetAsync("/api/bank-accounts/my");
        list.EnsureSuccessStatusCode();
        var listJson = await list.Content.ReadAsStringAsync();
        Assert.DoesNotContain("verificationCode", listJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("verificationCodeHash", listJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("482193", listJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BankAccounts_VerificationAttemptLimitWorks()
    {
        var (client, _) = await CreateNormalUserClientAsync();
        var request = DemoConnectRequest();
        request["verificationCode"] = "000000";

        for (var i = 0; i < 5; i++)
        {
            var failed = await client.PostAsJsonAsync("/api/bank-accounts/connect", request);
            await AssertValidationError(failed, "The bank account details could not be verified.");
        }

        var locked = await client.PostAsJsonAsync("/api/bank-accounts/connect", request);
        Assert.Equal((HttpStatusCode)429, locked.StatusCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_FionaAjetiReceivesOwnHolderName()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");

        var response = await client.GetAsync("/api/development/simulated-bank-credentials/3");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<DevelopmentCredentialsBody>();
        Assert.NotNull(body);
        Assert.Equal("Fiona Ajeti", body.AccountHolderName);
        Assert.Equal("NLB Banka - Kosovo", body.BankName);
        Assert.False(body.IsAlreadyLinked);
        Assert.Matches("^\\d{6}$", body.VerificationCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_DifferentUsersReceiveDifferentCredentials()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (fionaClient, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");
        var (olsaClient, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Olsa Shala");

        var fiona = await ReadDevelopmentCredentialsAsync(fionaClient, 3);
        var olsa = await ReadDevelopmentCredentialsAsync(olsaClient, 3);

        Assert.Equal("Fiona Ajeti", fiona.AccountHolderName);
        Assert.Equal("Olsa Shala", olsa.AccountHolderName);
        Assert.NotEqual(fiona.AccountNumber, olsa.AccountNumber);
        Assert.NotEqual(fiona.Iban, olsa.Iban);
        Assert.NotEqual(fiona.VerificationCode, olsa.VerificationCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_SameUserReceivesDifferentCredentialsForDifferentBanks()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");

        var raiffeisen = await ReadDevelopmentCredentialsAsync(client, 1);
        var nlb = await ReadDevelopmentCredentialsAsync(client, 3);

        Assert.NotEqual(raiffeisen.AccountNumber, nlb.AccountNumber);
        Assert.NotEqual(raiffeisen.Iban, nlb.Iban);
        Assert.NotEqual(raiffeisen.VerificationCode, nlb.VerificationCode);
        Assert.NotEqual(raiffeisen.CurrentBalance, nlb.CurrentBalance);
    }

    [Fact]
    public async Task DevelopmentCredentials_ReopeningReturnsConsistentCredentials()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");

        var first = await ReadDevelopmentCredentialsAsync(client, 3);
        var second = await ReadDevelopmentCredentialsAsync(client, 3);

        Assert.Equal(first.AccountNumber, second.AccountNumber);
        Assert.Equal(first.Iban, second.Iban);
        Assert.Equal(first.VerificationCode, second.VerificationCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_UserCannotRequestAnotherUsersCredentials()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (fionaClient, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");
        var (olsaClient, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Olsa Shala");

        var fiona = await ReadDevelopmentCredentialsAsync(fionaClient, 3);
        var request = DemoConnectRequest(3, fiona.AccountHolderName, fiona.AccountNumber, fiona.Iban, fiona.VerificationCode);

        var response = await olsaClient.PostAsJsonAsync("/api/bank-accounts/connect", request);

        await AssertValidationError(response, "The bank account details could not be verified.");
    }

    [Theory]
    [InlineData(ApplicationRoles.Admin)]
    [InlineData(ApplicationRoles.FraudAnalyst)]
    public async Task DevelopmentCredentials_AdminAndFraudAnalystCannotAccessEndpoint(string role)
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, role, $"{role} Test");

        var response = await client.GetAsync("/api/development/simulated-bank-credentials/3");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_EndpointIsUnavailableInProduction()
    {
        using var factory = PredictionApiFactory.Create("Production");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");

        var response = await client.GetAsync("/api/development/simulated-bank-credentials/3");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DevelopmentCredentials_AlreadyLinkedAccountsAreNotDuplicated()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");
        var credentials = await ReadDevelopmentCredentialsAsync(client, 3);

        var connect = await client.PostAsJsonAsync("/api/bank-accounts/connect", DemoConnectRequest(3, credentials.AccountHolderName, credentials.AccountNumber, credentials.Iban, credentials.VerificationCode));
        connect.EnsureSuccessStatusCode();

        var afterLink = await ReadDevelopmentCredentialsAsync(client, 3);
        Assert.True(afterLink.IsAlreadyLinked);
        Assert.Null(afterLink.AccountNumber);
        Assert.Null(afterLink.Iban);
        Assert.Null(afterLink.VerificationCode);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await dbContext.DemoBankAccounts.CountAsync(account => account.DevelopmentUserId != null && account.BankId == 3));
    }

    [Fact]
    public async Task DevelopmentCredentials_NormalVerificationStillRequiresCorrectCredentials()
    {
        using var factory = PredictionApiFactory.Create("Development");
        factory.ResetDatabase();
        var (client, _) = await CreateUserClientAsync(factory, ApplicationRoles.User, "Fiona Ajeti");
        var credentials = await ReadDevelopmentCredentialsAsync(client, 3);

        var wrongCode = DemoConnectRequest(3, credentials.AccountHolderName, credentials.AccountNumber, credentials.Iban, "000000");
        var failed = await client.PostAsJsonAsync("/api/bank-accounts/connect", wrongCode);
        await AssertValidationError(failed, "The bank account details could not be verified.");

        var valid = DemoConnectRequest(3, credentials.AccountHolderName, credentials.AccountNumber, credentials.Iban, credentials.VerificationCode);
        var response = await client.PostAsJsonAsync("/api/bank-accounts/connect", valid);
        response.EnsureSuccessStatusCode();
    }
    [Fact]
    public async Task CreateTransaction_WithSafePayment_CompletesAndUpdatesBalancesAtomically()
    {
        var accountId = await CreateDemoAccountAsync(1000m);
        var client = CreateUserOneClient();

        var response = await client.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            merchantId = 1,
            amount = 42.75m,
            currency = "EUR",
            transactionType = "PAYMENT",
            description = "Safe server controlled test",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TransactionResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("Completed", body.ProcessingStatus);
        Assert.Equal("safe", body.Status);
        Assert.NotNull(body.LatestPredictionId);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == accountId);
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == body.Id);
        Assert.Equal(957.25m, account.CurrentBalance);
        Assert.Equal(1000m, transaction.OldBalanceOrigin);
        Assert.Equal(957.25m, transaction.NewBalanceOrigin);
        Assert.Single(transaction.Predictions);
        Assert.False(await dbContext.FraudCases.AnyAsync(item => item.TransactionId == transaction.Id));
    }

    [Fact]
    public async Task CreateTransaction_WithInsufficientFunds_ReturnsValidationAndDoesNotCreateTransaction()
    {
        var accountId = await CreateDemoAccountAsync(10m);
        var client = CreateUserOneClient();

        var response = await client.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            merchantId = 1,
            amount = 42.75m,
            currency = "EUR",
            transactionType = "PAYMENT",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });

        await AssertValidationError(response, "Source account balance is insufficient");

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == accountId);
        Assert.Equal(10m, account.CurrentBalance);
    }

    [Fact]
    public async Task CreateTransaction_WithDuplicateIdempotencyKey_ReturnsExistingTransaction()
    {
        var accountId = await CreateDemoAccountAsync(1000m);
        var idempotencyKey = Guid.NewGuid().ToString("N");
        var client = CreateUserOneClient();
        var payload = new
        {
            sourceBankAccountId = accountId,
            merchantId = 1,
            amount = 42.75m,
            currency = "EUR",
            transactionType = "PAYMENT",
            idempotencyKey
        };

        var first = await client.PostAsJsonAsync("/api/transactions", payload);
        var second = await client.PostAsJsonAsync("/api/transactions", payload);

        first.EnsureSuccessStatusCode();
        second.EnsureSuccessStatusCode();
        var firstBody = await first.Content.ReadFromJsonAsync<TransactionResponseBody>();
        var secondBody = await second.Content.ReadFromJsonAsync<TransactionResponseBody>();
        Assert.Equal(firstBody?.Id, secondBody?.Id);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await dbContext.Transactions.CountAsync(item => item.IdempotencyKey == idempotencyKey));
        Assert.Equal(0, await dbContext.FraudCases.CountAsync(item => item.Transaction != null && item.Transaction.IdempotencyKey == idempotencyKey));
    }

    [Fact]
    public async Task CreateTransaction_WithReviewRiskTransfer_CreatesReviewCaseBeforeBalanceUpdates()
    {
        var accountId = await CreateDemoAccountAsync(1_250_000m);
        var client = CreateUserOneClient();

        var response = await client.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            description = "High risk transfer test",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TransactionResponseBody>();
        Assert.NotNull(body);
        Assert.Equal("PendingReview", body.ProcessingStatus);
        Assert.Equal("review", body.Status);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == accountId);
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == body.Id);
        var alert = await dbContext.FraudAlerts.SingleAsync(item => item.TransactionId == transaction.Id);
        var fraudCase = await dbContext.FraudCases.SingleAsync(item => item.TransactionId == transaction.Id);
        Assert.Equal(1_250_000m, account.CurrentBalance);
        Assert.Equal(1_250_000m, transaction.OldBalanceOrigin);
        Assert.Equal(250_000m, transaction.NewBalanceOrigin);
        Assert.Single(transaction.Predictions);
        Assert.Equal(alert.Id, fraudCase.FraudAlertId);
        Assert.Equal(FraudRiskPolicy.PriorityForRisk(fraudCase.ModelRiskScore), fraudCase.Priority);
        Assert.Equal(FraudRiskPolicy.ModelDecisionForRisk(fraudCase.ModelRiskScore, transaction.Predictions.First().IsFraud), fraudCase.ModelDecision);
    }

    [Fact]
    public async Task AnalystConfirmFraud_RejectsTransactionWithoutChangingBalancesAndPreservesPrediction()
    {
        var accountId = await CreateDemoAccountAsync(1_000_000m);
        var beneficiaryId = await CreateZeroBalanceBeneficiaryAsync();
        var userClient = CreateUserOneClient();
        var createResponse = await userClient.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });
        createResponse.EnsureSuccessStatusCode();
        var createBody = await createResponse.Content.ReadFromJsonAsync<TransactionResponseBody>();
        Assert.Equal("BlockedPendingReview", createBody?.ProcessingStatus);

        using var setupScope = _factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var fraudCase = await setupDb.FraudCases.Include(item => item.Prediction).SingleAsync();
        Assert.Equal("Fraud", fraudCase.ModelDecision);
        Assert.True(fraudCase.Prediction?.IsFraud);

        var analystClient = CreateAnalystClient();
        (await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/claim", new { })).EnsureSuccessStatusCode();
        var decisionResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/confirm-fraud", new { comment = "Account activity confirmed as unauthorized." });
        decisionResponse.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == accountId);
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == createBody!.Id);
        var reviewedCase = await dbContext.FraudCases.FirstAsync(item => item.TransactionId == createBody!.Id);
        Assert.Equal(1_000_000m, account.CurrentBalance);
        Assert.Equal("Rejected", transaction.ProcessingStatus);
        Assert.Equal("fraud", transaction.Status);
        Assert.Equal("ConfirmedFraud", reviewedCase.FinalDecision);
        Assert.Equal("Fraud", reviewedCase.ModelDecision);
        Assert.True(transaction.Predictions.Single().IsFraud);
    }

    [Fact]
    public async Task AnalystFalsePositive_CompletesTransactionAndPreservesFraudPrediction()
    {
        var accountId = await CreateDemoAccountAsync(1_000_000m);
        var beneficiaryId = await CreateZeroBalanceBeneficiaryAsync();
        var userClient = CreateUserOneClient();
        var createResponse = await userClient.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });
        createResponse.EnsureSuccessStatusCode();
        var createBody = await createResponse.Content.ReadFromJsonAsync<TransactionResponseBody>();
        Assert.Equal("BlockedPendingReview", createBody?.ProcessingStatus);

        using var setupScope = _factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var fraudCase = await setupDb.FraudCases.Include(item => item.Prediction).SingleAsync();
        Assert.True(fraudCase.Prediction?.IsFraud);

        var analystClient = CreateAnalystClient();
        (await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/claim", new { })).EnsureSuccessStatusCode();
        var decisionResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/false-positive", new { comment = "Customer verified the transfer as legitimate." });
        decisionResponse.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await dbContext.BankAccounts.FirstAsync(item => item.Id == accountId);
        var transaction = await dbContext.Transactions.Include(item => item.Predictions).FirstAsync(item => item.Id == createBody!.Id);
        var reviewedCase = await dbContext.FraudCases.FirstAsync(item => item.TransactionId == createBody!.Id);
        Assert.Equal(0m, account.CurrentBalance);
        Assert.Equal("Completed", transaction.ProcessingStatus);
        Assert.Equal("safe", transaction.Status);
        Assert.Equal("FalsePositive", reviewedCase.FinalDecision);
        Assert.Equal("Fraud", reviewedCase.ModelDecision);
        Assert.True(transaction.Predictions.Single().IsFraud);
    }

    [Fact]
    public async Task AnalystReviewQueue_ReturnsRealCaseAndClaimStartsReviewAndNoteWork()
    {
        var accountId = await CreateDemoAccountAsync(1_250_000m);
        var userClient = CreateUserOneClient();
        var createResponse = await userClient.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });
        createResponse.EnsureSuccessStatusCode();

        var analystClient = _factory.CreateClient();
        analystClient.DefaultRequestHeaders.Add("X-Test-User-Id", "101");
        analystClient.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.FraudAnalyst);

        var queueResponse = await analystClient.GetAsync("/api/analyst/review-queue?assignment=unassigned&page=1&pageSize=10");
        queueResponse.EnsureSuccessStatusCode();
        var queue = await queueResponse.Content.ReadFromJsonAsync<FraudCaseListResponseBody>();
        Assert.NotNull(queue);
        Assert.Equal(1, queue.TotalItems);
        var caseId = Assert.Single(queue.Items).Id;
        Assert.True(queue.Items[0].CanClaim);

        var claimResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{caseId}/claim", new { });
        claimResponse.EnsureSuccessStatusCode();
        var claimed = await claimResponse.Content.ReadFromJsonAsync<FraudCaseResponseBody>();
        Assert.Equal("UnderReview", claimed?.Status);
        Assert.Equal(101, claimed?.AssignedAnalystId);
        Assert.NotNull(claimed?.AssignedAt);
        Assert.NotNull(claimed?.ReviewStartedAt);

        var noteResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{caseId}/notes", new { comment = "Customer contacted and transaction details verified." });
        noteResponse.EnsureSuccessStatusCode();
        var noted = await noteResponse.Content.ReadFromJsonAsync<FraudCaseResponseBody>();
        Assert.Single(noted?.Notes ?? []);
    }

    [Fact]
    public async Task AnalystWorkflow_RemovedStartReviewAndEscalateEndpointsReturnNotFound()
    {
        var accountId = await CreateDemoAccountAsync(1_250_000m);
        var userClient = CreateUserOneClient();
        var createResponse = await userClient.PostAsJsonAsync("/api/transactions", new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            idempotencyKey = Guid.NewGuid().ToString("N")
        });
        createResponse.EnsureSuccessStatusCode();

        using var setupScope = _factory.Services.CreateScope();
        var setupDb = setupScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var fraudCase = await setupDb.FraudCases.SingleAsync();

        var analystClient = CreateAnalystClient();
        var startReviewResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/start-review", new { });
        var escalateResponse = await analystClient.PostAsJsonAsync($"/api/analyst/cases/{fraudCase.Id}/escalate", new { comment = "Escalate" });

        Assert.Equal(HttpStatusCode.NotFound, startReviewResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, escalateResponse.StatusCode);
    }

    [Fact]
    public async Task DuplicateHighRiskSubmission_DoesNotCreateDuplicateCases()
    {
        var accountId = await CreateDemoAccountAsync(1_250_000m);
        var idempotencyKey = Guid.NewGuid().ToString("N");
        var client = CreateUserOneClient();
        var payload = new
        {
            sourceBankAccountId = accountId,
            beneficiaryId = 1,
            amount = 1_000_000m,
            currency = "EUR",
            transactionType = "TRANSFER",
            idempotencyKey
        };

        var first = await client.PostAsJsonAsync("/api/transactions", payload);
        var second = await client.PostAsJsonAsync("/api/transactions", payload);
        first.EnsureSuccessStatusCode();
        second.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = await dbContext.Transactions.SingleAsync(item => item.IdempotencyKey == idempotencyKey);
        Assert.Equal(1, await dbContext.FraudCases.CountAsync(item => item.TransactionId == transaction.Id));
        Assert.Equal(1, await dbContext.FraudAlerts.CountAsync(item => item.TransactionId == transaction.Id));
    }

    private static Dictionary<string, object> SafePredictionRequest()
    {
        return new Dictionary<string, object>
        {
            ["transactionType"] = "PAYMENT",
            ["amount"] = 42.75,
            ["oldBalanceOrigin"] = 1000,
            ["newBalanceOrigin"] = 957.25,
            ["oldBalanceDestination"] = 500,
            ["newBalanceDestination"] = 542.75
        };
    }

    private static Dictionary<string, object> SuspiciousPredictionRequest()
    {
        return new Dictionary<string, object>
        {
            ["transactionType"] = "CASH_OUT",
            ["amount"] = 1000000,
            ["oldBalanceOrigin"] = 1000000,
            ["newBalanceOrigin"] = 0,
            ["oldBalanceDestination"] = 0,
            ["newBalanceDestination"] = 1000000
        };
    }

    private async Task<int> CreateStoredTransactionAsync(decimal amount, string transactionType)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = new Transaction
        {
            UserId = 99,
            Merchant = $"Test Merchant {Guid.NewGuid():N}",
            Category = "Money Transfer",
            Country = "United States",
            Amount = amount,
            Currency = "USD",
            RiskScore = null,
            Status = "pending",
            TransactionType = transactionType,
            Description = "Stored transaction analysis test",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync();
        return transaction.Id;
    }

    private async Task<int> CreateStoredTransactionForUserAsync(int userId)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = new Transaction
        {
            UserId = userId,
            Merchant = $"History Merchant {Guid.NewGuid():N}",
            Category = "Retail",
            Country = "Kosovo",
            Amount = 25m,
            Currency = "EUR",
            Status = "safe",
            ProcessingStatus = "Completed",
            TransactionType = "PAYMENT",
            Description = "Protected history test",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync();
        return transaction.Id;
    }

    private async Task<int> CreateReviewCaseAsync(int? assignedAnalystId)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var transaction = new Transaction
        {
            UserId = 99,
            Merchant = "Review Merchant",
            Category = "Money Transfer",
            Country = "Kosovo",
            Amount = 500m,
            Currency = "EUR",
            RiskScore = 62,
            Status = "review",
            ProcessingStatus = "PendingReview",
            TransactionType = "TRANSFER",
            Description = "Analyst transaction scope test",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync();

        var prediction = new Prediction
        {
            UserId = transaction.UserId,
            TransactionId = transaction.Id,
            TransactionType = transaction.TransactionType,
            Amount = transaction.Amount,
            RiskScore = 62,
            RiskLevel = "Medium",
            IsFraud = true,
            Confidence = 0.7,
            Explanation = "[]",
            SuggestedAction = "Manual review",
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Predictions.Add(prediction);
        await dbContext.SaveChangesAsync();

        var alert = new FraudAlert
        {
            UserId = transaction.UserId,
            TransactionId = transaction.Id,
            PredictionId = prediction.Id,
            Title = "Review required",
            Severity = "medium",
            Status = "open",
            RiskScore = 62,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.FraudAlerts.Add(alert);
        await dbContext.SaveChangesAsync();

        var fraudCase = new FraudCase
        {
            TransactionId = transaction.Id,
            PredictionId = prediction.Id,
            FraudAlertId = alert.Id,
            AssignedAnalystId = assignedAnalystId,
            Status = assignedAnalystId.HasValue ? "UnderReview" : "Open",
            Priority = "Medium",
            ModelRiskScore = 62,
            ModelDecision = "Fraud",
            AssignedAt = assignedAnalystId.HasValue ? DateTime.UtcNow : null,
            ReviewStartedAt = assignedAnalystId.HasValue ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.FraudCases.Add(fraudCase);
        await dbContext.SaveChangesAsync();
        return fraudCase.Id;
    }

    private async Task<int> CreateUserAsync(string role, string? fullName = null)
    {
        return await CreateUserAsync(_factory, role, fullName);
    }

    private static async Task<int> CreateUserAsync(PredictionApiFactory factory, string role, string? fullName = null)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = new User
        {
            FullName = fullName ?? $"Test User {Guid.NewGuid():N}",
            Email = $"user-{Guid.NewGuid():N}@example.com",
            PasswordHash = "unused",
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user.Id;
    }

    private async Task<int> CreateInactiveBankAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bank = new Bank
        {
            Name = $"Inactive Demo Bank {Guid.NewGuid():N}",
            Country = "Kosovo",
            SwiftCode = $"IN{Random.Shared.Next(100000, 999999)}",
            IsActive = false,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Banks.Add(bank);
        await dbContext.SaveChangesAsync();
        return bank.Id;
    }

    private async Task<(HttpClient Client, int UserId)> CreateNormalUserClientAsync(string? fullName = null)
    {
        var userId = await CreateUserAsync(ApplicationRoles.User, fullName);
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User-Id", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.User);
        return (client, userId);
    }

    private static async Task<(HttpClient Client, int UserId)> CreateUserClientAsync(PredictionApiFactory factory, string role, string? fullName = null)
    {
        var userId = await CreateUserAsync(factory, role, fullName);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User-Id", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", role);
        return (client, userId);
    }

    private async Task CreateAccountForUserAsync(int userId, int bankId, string accountType)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Random.Shared.Next(100000, 999999).ToString();
        var account = new BankAccount
        {
            UserId = userId,
            BankId = bankId,
            AccountName = $"{accountType} Account",
            AccountHolderName = $"Limit User {userId}",
            AccountNumber = $"LIM{userId}{bankId}{suffix}",
            IBAN = $"XK05{bankId:D2}{userId:D8}{suffix}",
            Currency = "EUR",
            CurrentBalance = 1000m,
            AccountType = accountType,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.BankAccounts.Add(account);
        await dbContext.SaveChangesAsync();
    }

    private static Dictionary<string, object> DemoConnectRequest(
        int bankId = 1,
        string holderName = "Fiona Ajeti",
        string? accountNumber = "1000123456",
        string? iban = "XK051234567890123456",
        string? verificationCode = "482193")
    {
        return new Dictionary<string, object>
        {
            ["bankId"] = bankId,
            ["accountHolderName"] = holderName,
            ["accountNumber"] = accountNumber ?? string.Empty,
            ["iban"] = iban ?? string.Empty,
            ["verificationCode"] = verificationCode ?? string.Empty
        };
    }

    private static async Task<DevelopmentCredentialsBody> ReadDevelopmentCredentialsAsync(HttpClient client, int bankId)
    {
        var response = await client.GetAsync($"/api/development/simulated-bank-credentials/{bankId}");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<DevelopmentCredentialsBody>();
        Assert.NotNull(body);
        return body;
    }

    private HttpClient CreateUserOneClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User-Id", "1");
        client.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.User);
        return client;
    }

    private HttpClient CreateAnalystClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-User-Id", "101");
        client.DefaultRequestHeaders.Add("X-Test-Role", ApplicationRoles.FraudAnalyst);
        return client;
    }

    private async Task<int> CreateDemoAccountAsync(decimal balance)
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Random.Shared.Next(100000, 999999).ToString();
        var account = new BankAccount
        {
            UserId = 1,
            BankId = 1,
            AccountName = "Test Transaction Account",
            AccountHolderName = "Prediction Test User",
            AccountNumber = $"FGDTEST{suffix}",
            IBAN = $"XK051212000000{suffix}",
            Currency = "EUR",
            CurrentBalance = balance,
            AccountType = "Checking",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.BankAccounts.Add(account);
        await dbContext.SaveChangesAsync();
        return account.Id;
    }

    private async Task<int> CreateZeroBalanceBeneficiaryAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Random.Shared.Next(100000, 999999).ToString();
        var destinationAccount = new BankAccount
        {
            UserId = 99,
            BankId = 1,
            AccountName = "High Risk Destination",
            AccountHolderName = "High Risk Recipient",
            AccountNumber = $"FGDDEST{suffix}",
            IBAN = $"XK051313000000{suffix}",
            Currency = "EUR",
            CurrentBalance = 0m,
            AccountType = "Current",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var beneficiary = new Beneficiary
        {
            UserId = 1,
            FullName = "High Risk Recipient",
            BankId = 1,
            DestinationBankAccount = destinationAccount,
            MaskedAccountReference = $"**** {suffix[^4..]}",
            IsTrusted = false,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Beneficiaries.Add(beneficiary);
        await dbContext.SaveChangesAsync();
        return beneficiary.Id;
    }

    private static ServiceProvider CreateSeederProvider()
    {
        var services = new ServiceCollection();
        var databaseRoot = new InMemoryDatabaseRoot();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase($"demo-user-seeder-{Guid.NewGuid():N}", databaseRoot));
        return services.BuildServiceProvider();
    }

    private static Dictionary<string, object> StoredBalanceRequest()
    {
        return new Dictionary<string, object>
        {
            ["oldBalanceOrigin"] = 1000000,
            ["newBalanceOrigin"] = 0,
            ["oldBalanceDestination"] = 0,
            ["newBalanceDestination"] = 1000000
        };
    }

    private static async Task AssertValidationError(HttpResponseMessage response, string expectedMessage)
    {
        var content = await response.Content.ReadAsStringAsync();
        var messages = new List<string>();
        using var document = JsonDocument.Parse(content);
        if (document.RootElement.TryGetProperty("message", out var messageElement)
            && messageElement.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(messageElement.GetString()))
        {
            messages.Add(messageElement.GetString()!);
        }

        if (document.RootElement.TryGetProperty("errors", out var errorsElement))
        {
            if (errorsElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in errorsElement.EnumerateObject())
                {
                    messages.AddRange(property.Value.EnumerateArray().Select(item => item.GetString()).Where(item => !string.IsNullOrWhiteSpace(item))!);
                }
            }
            else if (errorsElement.ValueKind == JsonValueKind.Array)
            {
                messages.AddRange(errorsElement.EnumerateArray().Select(item => item.GetString()).Where(item => !string.IsNullOrWhiteSpace(item))!);
            }
        }

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(
            messages,
            message => message.Contains(expectedMessage, StringComparison.OrdinalIgnoreCase));
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private sealed class PredictionResponseBody
    {
        public int? TransactionId { get; set; }

        public string PredictedClass { get; set; } = string.Empty;

        public int RiskScore { get; set; }

        public string RiskLevel { get; set; } = string.Empty;

        public bool IsFraud { get; set; }

        public double FraudProbability { get; set; }

        public string? ModelName { get; set; }

        public string? ModelVersion { get; set; }

        public string[] Reasons { get; set; } = [];

        public RiskBreakdownFactorBody[] RiskBreakdown { get; set; } = [];
    }

    private sealed class TransactionPredictionResponseBody
    {
        public int TransactionId { get; set; }

        public int PredictionId { get; set; }

        public string Status { get; set; } = string.Empty;

        public string[] Explanation { get; set; } = [];
    }

    private sealed class TransactionResponseBody
    {
        public int Id { get; set; }

        public string Status { get; set; } = string.Empty;

        public string ProcessingStatus { get; set; } = string.Empty;

        public int? LatestPredictionId { get; set; }
    }

    private sealed class BankResponseBody
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;
    }

    private sealed class BankAccountResponseBody
    {
        public int Id { get; set; }

        public int BankId { get; set; }

        public string BankName { get; set; } = string.Empty;

        public string AccountHolderName { get; set; } = string.Empty;

        public string AccountType { get; set; } = string.Empty;

        public string MaskedAccountNumber { get; set; } = string.Empty;

        public string MaskedIban { get; set; } = string.Empty;

        public string Currency { get; set; } = string.Empty;

        public decimal CurrentBalance { get; set; }
    }

    private sealed class DevelopmentCredentialsBody
    {
        public int BankId { get; set; }

        public string BankName { get; set; } = string.Empty;

        public string AccountHolderName { get; set; } = string.Empty;

        public string? AccountNumber { get; set; }

        public string? Iban { get; set; }

        public string? VerificationCode { get; set; }

        public string AccountType { get; set; } = string.Empty;

        public string Currency { get; set; } = string.Empty;

        public decimal CurrentBalance { get; set; }

        public bool IsAlreadyLinked { get; set; }
    }

    private sealed class FraudCaseListResponseBody
    {
        public FraudCaseResponseBody[] Items { get; set; } = [];

        public int TotalItems { get; set; }
    }

    private sealed class AnalystTransactionListResponseBody
    {
        public AnalystTransactionSummaryBody Summary { get; set; } = new();

        public AnalystTransactionResponseBody[] Items { get; set; } = [];
    }

    private sealed class AnalystTransactionSummaryBody
    {
        public int TotalTransactions { get; set; }
    }

    private sealed class AnalystTransactionResponseBody
    {
        public string TransactionReference { get; set; } = string.Empty;
    }

    private sealed class FraudCaseResponseBody
    {
        public int Id { get; set; }

        public int? AssignedAnalystId { get; set; }

        public string Status { get; set; } = string.Empty;

        public bool CanClaim { get; set; }

        public DateTime? AssignedAt { get; set; }

        public DateTime? ReviewStartedAt { get; set; }

        public FraudCaseNoteResponseBody[] Notes { get; set; } = [];
    }

    private sealed class FraudCaseNoteResponseBody
    {
        public string Comment { get; set; } = string.Empty;
    }

    private sealed class RiskBreakdownFactorBody
    {
        public string Factor { get; set; } = string.Empty;

        public string Impact { get; set; } = string.Empty;

        public string Explanation { get; set; } = string.Empty;
    }

    private sealed class ErrorResponse
    {
        public string Message { get; set; } = string.Empty;
    }

    private sealed class AdminUserResponseBody
    {
        public int Id { get; set; }

        public string Role { get; set; } = string.Empty;
    }

    private sealed class ValidationProblemResponse
    {
        public Dictionary<string, string[]> Errors { get; set; } = [];
    }
}

public sealed class PredictionApiFactory : WebApplicationFactory<Program>
{
    private readonly InMemoryDatabaseRoot _databaseRoot = new();
    private readonly string _environmentName;
    private readonly string _databaseName;

    public PredictionApiFactory()
        : this("Testing")
    {
    }

    private PredictionApiFactory(string environmentName)
    {
        _environmentName = environmentName;
        _databaseName = $"prediction-tests-{Guid.NewGuid():N}";
    }

    public static PredictionApiFactory Create(string environmentName)
    {
        return new PredictionApiFactory(environmentName);
    }

    public void ResetDatabase()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        SeedTestDatabase(dbContext);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(_environmentName);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName, _databaseRoot));

            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });

            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });

            using var provider = services.BuildServiceProvider();
            using var scope = provider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            SeedTestDatabase(dbContext);
        });
    }

    private static void SeedTestDatabase(AppDbContext dbContext)
    {
        dbContext.Database.EnsureDeleted();
        dbContext.Database.EnsureCreated();
        dbContext.Users.AddRange(new User
        {
            Id = 99,
            FullName = "Prediction Test User",
            Email = "prediction-test@example.com",
            PasswordHash = "unused",
            Role = ApplicationRoles.User,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        },
        new User
        {
            Id = 100,
            FullName = "Prediction Test Admin",
            Email = "prediction-admin@example.com",
            PasswordHash = "unused",
            Role = ApplicationRoles.Admin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        },
        new User
        {
            Id = 101,
            FullName = "Prediction Test Analyst",
            Email = "prediction-analyst@example.com",
            PasswordHash = "unused",
            Role = ApplicationRoles.FraudAnalyst,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.SaveChanges();
        MerchantDevelopmentSeeder.SeedAsync(dbContext, NullLogger.Instance).GetAwaiter().GetResult();
    }
}

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers.TryGetValue("X-Test-User-Id", out var userIdHeader)
            ? userIdHeader.ToString()
            : "99";
        var userName = userId == "100"
            ? "Prediction Test Admin"
            : userId == "101"
                ? "Prediction Test Analyst"
                : "Prediction Test User";
        var role = Request.Headers.TryGetValue("X-Test-Role", out var roleHeader)
            ? roleHeader.ToString()
            : ApplicationRoles.User;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}


