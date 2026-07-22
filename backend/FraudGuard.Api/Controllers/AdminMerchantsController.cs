using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using FraudGuard.Api.Security;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = ApplicationRoles.Admin)]
[Route("api/admin/merchants")]
public class AdminMerchantsController : ControllerBase
{
    private static readonly string[] Categories =
    [
        "Grocery", "Retail", "Electronics", "Restaurant", "Travel", "Utilities",
        "Healthcare", "Entertainment", "Fuel", "Online Services", "Books", "Other"
    ];
    private static readonly string[] RiskLevels = ["Low", "Medium", "High"];
    private static readonly Regex MerchantCodePattern = new("^[A-Z0-9-]{2,40}$", RegexOptions.Compiled);
    private static readonly Regex MccPattern = new("^\\d{3,6}$", RegexOptions.Compiled);

    private readonly AppDbContext _dbContext;
    private readonly ISystemLogService _systemLogService;

    public AdminMerchantsController(AppDbContext dbContext, ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _systemLogService = systemLogService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminMerchantDto>>> GetMerchants(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] int? bankId,
        [FromQuery] string? riskLevel,
        [FromQuery] bool? isActive,
        CancellationToken cancellationToken)
    {
        var query = MerchantQuery();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(merchant =>
                merchant.Name.Contains(term)
                || merchant.MerchantCode.Contains(term)
                || merchant.Category.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedCategory = category.Trim();
            query = query.Where(merchant => merchant.Category == normalizedCategory);
        }

        if (bankId.HasValue && bankId.Value > 0)
        {
            query = query.Where(merchant => merchant.BankId == bankId.Value);
        }

        if (!string.IsNullOrWhiteSpace(riskLevel) && !string.Equals(riskLevel, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedRisk = NormalizeRiskLevel(riskLevel);
            if (normalizedRisk is not null)
            {
                query = query.Where(merchant => merchant.RiskLevel == normalizedRisk);
            }
        }

        if (isActive.HasValue)
        {
            query = query.Where(merchant => merchant.IsActive == isActive.Value);
        }

        var merchants = await query
            .OrderBy(merchant => merchant.Name)
            .Select(merchant => ToAdminDto(merchant))
            .ToListAsync(cancellationToken);

        return Ok(merchants);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminMerchantDto>> GetMerchant(int id, CancellationToken cancellationToken)
    {
        var merchant = await MerchantQuery().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return merchant is null ? NotFound(new { message = "Merchant not found." }) : Ok(ToAdminDto(merchant));
    }

    [HttpPost]
    public async Task<ActionResult<AdminMerchantDto>> CreateMerchant(UpsertMerchantRequest request, CancellationToken cancellationToken)
    {
        var validation = await ValidateRequestAsync(request, null, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var now = DateTime.UtcNow;
        var merchant = new Merchant
        {
            Name = request.Name.Trim(),
            MerchantCode = NormalizeMerchantCode(request.MerchantCode),
            Category = NormalizeCategory(request.Category)!,
            MerchantCategoryCode = NormalizeOptional(request.MerchantCategoryCode),
            Country = request.Country.Trim(),
            BankId = request.BankId,
            RiskLevel = NormalizeRiskLevel(request.RiskLevel)!,
            IsVerified = request.IsVerified,
            IsActive = request.IsActive,
            CreatedAt = now
        };

        var executionStrategy = _dbContext.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var dbTransaction = IsInMemoryDatabase()
                ? null
                : await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            _dbContext.Merchants.Add(merchant);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var settlementAccount = await CreateSettlementAccountAsync(merchant, cancellationToken);
            merchant.SettlementBankAccountId = settlementAccount.Id;
            settlementAccount.MerchantId = merchant.Id;
            await _dbContext.SaveChangesAsync(cancellationToken);

            if (dbTransaction is not null)
            {
                await dbTransaction.CommitAsync(cancellationToken);
            }

            await _systemLogService.LogAsync("Success", "admin", $"Merchant {merchant.MerchantCode} created.", GetCurrentUserId(), null, cancellationToken);

            var created = await MerchantQuery().FirstAsync(item => item.Id == merchant.Id, cancellationToken);
            return CreatedAtAction(nameof(GetMerchant), new { id = merchant.Id }, ToAdminDto(created));
        });
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminMerchantDto>> UpdateMerchant(int id, UpsertMerchantRequest request, CancellationToken cancellationToken)
    {
        var merchant = await _dbContext.Merchants
            .Include(item => item.SettlementBankAccount)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (merchant is null)
        {
            return NotFound(new { message = "Merchant not found." });
        }

        var validation = await ValidateRequestAsync(request, id, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        merchant.Name = request.Name.Trim();
        merchant.MerchantCode = NormalizeMerchantCode(request.MerchantCode);
        merchant.Category = NormalizeCategory(request.Category)!;
        merchant.MerchantCategoryCode = NormalizeOptional(request.MerchantCategoryCode);
        merchant.Country = request.Country.Trim();
        merchant.BankId = request.BankId;
        merchant.RiskLevel = NormalizeRiskLevel(request.RiskLevel)!;
        merchant.IsVerified = request.IsVerified;
        merchant.IsActive = request.IsActive;
        merchant.UpdatedAt = DateTime.UtcNow;

        if (merchant.SettlementBankAccount is not null && merchant.SettlementBankAccount.BankId != request.BankId)
        {
            merchant.SettlementBankAccount.BankId = request.BankId;
            merchant.SettlementBankAccount.UpdatedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "admin", $"Merchant {merchant.MerchantCode} updated.", GetCurrentUserId(), null, cancellationToken);

        var updated = await MerchantQuery().FirstAsync(item => item.Id == merchant.Id, cancellationToken);
        return Ok(ToAdminDto(updated));
    }

    [HttpPatch("{id:int}/activate")]
    public Task<ActionResult<AdminMerchantDto>> Activate(int id, CancellationToken cancellationToken)
    {
        return SetActiveAsync(id, true, cancellationToken);
    }

    [HttpPatch("{id:int}/deactivate")]
    public async Task<ActionResult<AdminMerchantDto>> Deactivate(int id, CancellationToken cancellationToken)
    {
        var hasProcessingPayments = await _dbContext.Transactions.AnyAsync(transaction =>
            transaction.MerchantId == id
            && transaction.TransactionType == "PAYMENT"
            && transaction.ProcessingStatus == "PendingAnalysis",
            cancellationToken);

        if (hasProcessingPayments)
        {
            return Conflict(new { message = "Merchant cannot be deactivated while a payment is processing." });
        }

        return await SetActiveAsync(id, false, cancellationToken);
    }

    private async Task<ActionResult<AdminMerchantDto>> SetActiveAsync(int id, bool active, CancellationToken cancellationToken)
    {
        var merchant = await _dbContext.Merchants.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (merchant is null)
        {
            return NotFound(new { message = "Merchant not found." });
        }

        merchant.IsActive = active;
        merchant.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "admin", $"Merchant {merchant.MerchantCode} {(active ? "activated" : "deactivated")}.", GetCurrentUserId(), null, cancellationToken);

        var updated = await MerchantQuery().FirstAsync(item => item.Id == merchant.Id, cancellationToken);
        return Ok(ToAdminDto(updated));
    }

    private IQueryable<Merchant> MerchantQuery()
    {
        return _dbContext.Merchants
            .AsNoTracking()
            .Include(merchant => merchant.Bank)
            .Include(merchant => merchant.SettlementBankAccount);
    }

    private async Task<ActionResult?> ValidateRequestAsync(UpsertMerchantRequest request, int? merchantId, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100)
        {
            return BadRequest(new { message = "Merchant name is required and must be at most 100 characters." });
        }

        var code = NormalizeMerchantCode(request.MerchantCode);
        if (!MerchantCodePattern.IsMatch(code))
        {
            return BadRequest(new { message = "Merchant code may contain only letters, digits, and hyphens." });
        }

        var codeExists = await _dbContext.Merchants.AnyAsync(merchant =>
            merchant.MerchantCode == code && (!merchantId.HasValue || merchant.Id != merchantId.Value),
            cancellationToken);
        if (codeExists)
        {
            return Conflict(new { message = "Merchant code is already in use." });
        }

        if (NormalizeCategory(request.Category) is null)
        {
            return BadRequest(new { message = "Select a valid merchant category." });
        }

        var mcc = NormalizeOptional(request.MerchantCategoryCode);
        if (mcc is not null && !MccPattern.IsMatch(mcc))
        {
            return BadRequest(new { message = "Merchant category code must be numeric." });
        }

        if (NormalizeRiskLevel(request.RiskLevel) is null)
        {
            return BadRequest(new { message = "Risk level must be Low, Medium, or High." });
        }

        var bankExists = await _dbContext.Banks.AnyAsync(bank => bank.Id == request.BankId && bank.IsActive, cancellationToken);
        if (!bankExists)
        {
            return BadRequest(new { message = "Selected bank is not available." });
        }

        return null;
    }

    private async Task<BankAccount> CreateSettlementAccountAsync(Merchant merchant, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var suffix = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
            var accountNumber = $"FGM-{merchant.BankId:0000}-{suffix}";
            var iban = $"XK05MERCH{merchant.BankId:0000}{suffix}";

            var exists = await _dbContext.BankAccounts.AnyAsync(account =>
                account.AccountNumber == accountNumber || account.IBAN == iban,
                cancellationToken);
            if (exists)
            {
                continue;
            }

            var account = new BankAccount
            {
                UserId = null,
                MerchantId = merchant.Id,
                BankId = merchant.BankId,
                AccountNumber = accountNumber,
                IBAN = iban,
                AccountName = $"{merchant.Name} Settlement",
                AccountHolderName = merchant.Name,
                Currency = "EUR",
                CurrentBalance = 0m,
                AccountType = "Merchant Settlement",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.BankAccounts.Add(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return account;
        }

        throw new InvalidOperationException("Unable to generate a unique merchant settlement account.");
    }

    private int? GetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var id) ? id : null;
    }

    private bool IsInMemoryDatabase()
    {
        return _dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }

    private static AdminMerchantDto ToAdminDto(Merchant merchant)
    {
        return new AdminMerchantDto
        {
            Id = merchant.Id,
            Name = merchant.Name,
            MerchantCode = merchant.MerchantCode,
            Category = merchant.Category,
            MerchantCategoryCode = merchant.MerchantCategoryCode,
            Country = merchant.Country,
            BankId = merchant.BankId,
            BankName = merchant.Bank?.Name ?? string.Empty,
            MaskedSettlementAccount = merchant.SettlementBankAccount is null ? null : BankAccountDomain.MaskAccountNumber(merchant.SettlementBankAccount.AccountNumber),
            MaskedSettlementIban = merchant.SettlementBankAccount is null ? null : BankAccountDomain.MaskIban(merchant.SettlementBankAccount.IBAN),
            RiskLevel = merchant.RiskLevel,
            IsVerified = merchant.IsVerified,
            IsActive = merchant.IsActive,
            CreatedAt = merchant.CreatedAt,
            UpdatedAt = merchant.UpdatedAt
        };
    }

    private static string NormalizeMerchantCode(string value)
    {
        return value.Trim().ToUpperInvariant();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeCategory(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Categories.FirstOrDefault(category => string.Equals(category, value.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeRiskLevel(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return RiskLevels.FirstOrDefault(level => string.Equals(level, value.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}
