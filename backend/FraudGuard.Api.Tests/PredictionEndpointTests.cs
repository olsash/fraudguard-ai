using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Encodings.Web;
using FraudGuard.Api.Data;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace FraudGuard.Api.Tests;

public class PredictionEndpointTests : IClassFixture<PredictionApiFactory>
{
    private readonly HttpClient _client;

    public PredictionEndpointTests(PredictionApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreatePrediction_WithValidRequest_ReturnsPredictionResult()
    {
        var response = await _client.PostAsJsonAsync("/api/predictions", ValidPredictionRequest());

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<PredictionResponseBody>();

        Assert.NotNull(body);
        Assert.Equal("Fraud", body.PredictedClass);
        Assert.True(body.RiskScore >= 0);
        Assert.True(body.FraudProbability >= 0);
        Assert.Equal("Random Forest - test", body.ModelName);
        Assert.Contains(body.RiskBreakdown, factor => factor.Factor == "High transaction amount");
        Assert.Contains(body.RiskBreakdown, factor => factor.Factor == "Transfer or cash-out transaction type");
    }

    [Fact]
    public async Task CreatePrediction_WithMissingAmount_ReturnsClearValidationError()
    {
        var request = ValidPredictionRequest();
        request.Remove("amount");

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, "Amount is required.");
    }

    [Fact]
    public async Task CreatePrediction_WithNegativeAmount_ReturnsClearValidationError()
    {
        var request = ValidPredictionRequest();
        request["amount"] = -1;

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, "Amount must be numeric and non-negative.");
    }

    [Fact]
    public async Task CreatePrediction_WithInvalidTransactionType_ReturnsClearError()
    {
        var request = ValidPredictionRequest();
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
        var request = ValidPredictionRequest();
        request.Remove(missingField);

        var response = await _client.PostAsJsonAsync("/api/predictions", request);

        await AssertValidationError(response, expectedMessage);
    }

    private static Dictionary<string, object> ValidPredictionRequest()
    {
        return new Dictionary<string, object>
        {
            ["transactionType"] = "TRANSFER",
            ["amount"] = 250000,
            ["oldBalanceOrigin"] = 300000,
            ["newBalanceOrigin"] = 50000,
            ["oldBalanceDestination"] = 0,
            ["newBalanceDestination"] = 250000
        };
    }

    private static async Task AssertValidationError(HttpResponseMessage response, string expectedMessage)
    {
        var body = await response.Content.ReadFromJsonAsync<ValidationProblemResponse>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull(body);
        Assert.Contains(
            body.Errors.SelectMany(error => error.Value),
            message => message.Contains(expectedMessage, StringComparison.OrdinalIgnoreCase));
    }

    private sealed class PredictionResponseBody
    {
        public string PredictedClass { get; set; } = string.Empty;

        public int RiskScore { get; set; }

        public double FraudProbability { get; set; }

        public string? ModelName { get; set; }

        public RiskBreakdownFactorBody[] RiskBreakdown { get; set; } = [];
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
                options.UseInMemoryDatabase($"prediction-tests-{Guid.NewGuid()}"));

            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });

            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });

            services.AddHttpClient<PythonPredictionService>()
                .ConfigurePrimaryHttpMessageHandler(() => new FakeMlPredictionHandler());

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

public sealed class FakeMlPredictionHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri?.AbsolutePath != "/predict")
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }

        var payload = new
        {
            fraudProbability = 0.91,
            riskScore = 91,
            riskLevel = "High",
            isFraud = true,
            predictedClass = "Fraud",
            confidence = 0.91,
            modelName = "Random Forest - test",
            modelTrainingDate = "2026-01-01T00:00:00Z",
            reasons = new[] { "Model Signals|Test model returned a high fraud probability." },
            explanationFactors = new[] { "Model Signals|Test model returned a high fraud probability." },
            riskBreakdown = new[]
            {
                new
                {
                    factor = "High transaction amount",
                    impact = "Risk",
                    explanation = "Amount is above the high-value threshold."
                },
                new
                {
                    factor = "Transfer or cash-out transaction type",
                    impact = "Risk",
                    explanation = "TRANSFER is treated as fraud-sensitive."
                }
            },
            suggestedAction = "Manual review required"
        };

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(payload)
        });
    }
}
