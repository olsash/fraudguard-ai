using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Encodings.Web;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
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

    private sealed class ValidationProblemResponse
    {
        public Dictionary<string, string[]> Errors { get; set; } = [];
    }
}

public sealed class PredictionApiFactory : WebApplicationFactory<Program>
{
    private readonly InMemoryDatabaseRoot _databaseRoot = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("prediction-tests", _databaseRoot));

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
            dbContext.Database.EnsureDeleted();
            dbContext.Database.EnsureCreated();
            dbContext.Users.Add(new User
            {
                Id = 99,
                FullName = "Prediction Test User",
                Email = "prediction-test@example.com",
                PasswordHash = "unused",
                Role = "User",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            dbContext.SaveChanges();
        });
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
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "99"),
            new Claim(ClaimTypes.Name, "Prediction Test User"),
            new Claim(ClaimTypes.Role, "User")
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
