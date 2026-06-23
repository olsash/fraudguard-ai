using System.Text;
using FraudGuard.Api.Data;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "DataProtectionKeys")));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<ISystemLogService, SystemLogService>();
builder.Services.AddHttpClient<AdminModelService>(client =>
{
    var baseUrl =
        builder.Configuration["MlService:BaseUrl"]
        ?? builder.Configuration["PythonPredictionService:BaseUrl"]
        ?? "http://localhost:8000";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
});
builder.Services.AddHttpClient<PythonPredictionService>(client =>
{
    var baseUrl =
        builder.Configuration["MlService:BaseUrl"]
        ?? builder.Configuration["PythonPredictionService:BaseUrl"]
        ?? "http://localhost:8000";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
});

var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSettings["Secret"] ?? throw new InvalidOperationException("JWT secret is missing.");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = signingKey
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://localhost:8080")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    try
    {
        if (!dbContext.SystemLogs.Any())
        {
            dbContext.SystemLogs.AddRange(
                new FraudGuard.Api.Models.SystemLog
                {
                    Level = "Info",
                    Source = "api",
                    Message = "FraudGuard API started in development mode.",
                    Method = "SYSTEM",
                    Path = "/startup",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-12)
                },
                new FraudGuard.Api.Models.SystemLog
                {
                    Level = "Success",
                    Source = "auth",
                    Message = "Development seed users are available for sign-in.",
                    Method = "SYSTEM",
                    Path = "/api/auth/login",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-10)
                },
                new FraudGuard.Api.Models.SystemLog
                {
                    Level = "Info",
                    Source = "admin",
                    Message = "Admin logs module initialized.",
                    Method = "SYSTEM",
                    Path = "/api/admin/logs",
                    CreatedAt = DateTime.UtcNow.AddMinutes(-8)
                });
            dbContext.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogDebug(ex, "Skipped development system log seeding.");
    }
}

app.Run();

public partial class Program;
