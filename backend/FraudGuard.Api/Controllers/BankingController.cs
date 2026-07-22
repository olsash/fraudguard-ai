using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
[Authorize]
[Route("api/banking")]
public class BankingController : ControllerBase
{
    private static readonly Regex AccountReferencePattern = new("^[A-Za-z0-9\\-\\s]{6,34}$", RegexOptions.Compiled);
    private readonly AppDbContext _dbContext;
    private readonly ISystemLogService _systemLogService;

    public BankingController(AppDbContext dbContext, ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _systemLogService = systemLogService;
    }

    [HttpGet("banks")]
    public async Task<ActionResult<IEnumerable<BankDto>>> GetBanks(CancellationToken cancellationToken)
    {
        var banks = await _dbContext.Banks
            .AsNoTracking()
            .Where(bank => bank.IsActive)
            .OrderBy(bank => bank.Name)
            .Select(bank => new BankDto
            {
                Id = bank.Id,
                Name = bank.Name,
                Country = bank.Country,
                SwiftCode = bank.SwiftCode
            })
            .ToListAsync(cancellationToken);

        return Ok(banks);
    }

    [HttpGet("accounts")]
    public async Task<ActionResult<IEnumerable<BankAccountDto>>> GetAccounts([FromQuery] int? userId, CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var targetUserId = ApplicationRoles.IsPrivilegedReviewRole(User) && userId.HasValue
            ? userId.Value
            : currentUserId.Value;

        var accounts = await _dbContext.BankAccounts
            .AsNoTracking()
            .Include(account => account.Bank)
            .Where(account => account.UserId == targetUserId)
            .OrderByDescending(account => account.IsActive)
            .ThenByDescending(account => account.CreatedAt)
            .Select(account => ToAccountDto(account))
            .ToListAsync(cancellationToken);

        return Ok(accounts);
    }

    [HttpGet("beneficiaries")]
    public async Task<ActionResult<IEnumerable<BeneficiaryDto>>> GetBeneficiaries(CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var beneficiaries = await _dbContext.Beneficiaries
            .AsNoTracking()
            .Include(beneficiary => beneficiary.Bank)
            .Where(beneficiary => beneficiary.UserId == currentUserId.Value)
            .OrderByDescending(beneficiary => beneficiary.IsTrusted)
            .ThenBy(beneficiary => beneficiary.FullName)
            .Select(beneficiary => ToBeneficiaryDto(beneficiary))
            .ToListAsync(cancellationToken);

        return Ok(beneficiaries);
    }

    [HttpPost("beneficiaries")]
    public async Task<ActionResult<BeneficiaryDto>> CreateBeneficiary(CreateBeneficiaryRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var fullName = request.FullName.Trim();
        var accountReference = NormalizeAccountReference(request.AccountReference);
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return BadRequest(new { message = "Beneficiary name is required." });
        }

        if (!AccountReferencePattern.IsMatch(accountReference))
        {
            return BadRequest(new { message = "Account reference must be 6 to 34 letters, numbers, spaces, or hyphens." });
        }

        var bankExists = await _dbContext.Banks
            .AnyAsync(bank => bank.Id == request.BankId && bank.IsActive, cancellationToken);

        if (!bankExists)
        {
            return BadRequest(new { message = "Selected bank is not available." });
        }

        var internalAccount = await _dbContext.BankAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(account =>
                account.BankId == request.BankId
                && (account.AccountNumber == accountReference || account.IBAN == accountReference),
                cancellationToken);

        var beneficiary = new Beneficiary
        {
            UserId = currentUserId.Value,
            FullName = fullName,
            BankId = request.BankId,
            DestinationBankAccountId = internalAccount?.Id,
            MaskedAccountReference = Mask(accountReference),
            IsTrusted = request.IsTrusted,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Beneficiaries.Add(beneficiary);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "profile", $"Beneficiary {beneficiary.FullName} saved.", beneficiary.UserId, null, cancellationToken);

        var created = await _dbContext.Beneficiaries
            .AsNoTracking()
            .Include(item => item.Bank)
            .FirstAsync(item => item.Id == beneficiary.Id, cancellationToken);

        return CreatedAtAction(nameof(GetBeneficiaries), new { id = beneficiary.Id }, ToBeneficiaryDto(created));
    }

    [HttpGet("merchants")]
    public async Task<ActionResult<IEnumerable<MerchantDto>>> GetMerchants(CancellationToken cancellationToken)
    {
        var merchants = await _dbContext.Merchants
            .AsNoTracking()
            .Include(merchant => merchant.Bank)
            .Where(merchant => merchant.IsActive && merchant.IsVerified)
            .OrderBy(merchant => merchant.Name)
            .Select(merchant => new MerchantDto
            {
                Id = merchant.Id,
                Name = merchant.Name,
                MerchantCode = merchant.MerchantCode,
                Category = merchant.Category,
                Country = merchant.Country,
                BankName = merchant.Bank == null ? string.Empty : merchant.Bank.Name,
                RiskLevel = merchant.RiskLevel
            })
            .ToListAsync(cancellationToken);

        return Ok(merchants);
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static BankAccountDto ToAccountDto(BankAccount account)
    {
        return new BankAccountDto
        {
            Id = account.Id,
            BankId = account.BankId,
            BankName = account.Bank?.Name ?? string.Empty,
            AccountHolderName = account.AccountHolderName,
            AccountType = account.AccountType,
            MaskedAccountNumber = BankAccountDomain.MaskAccountNumber(account.AccountNumber),
            MaskedIban = BankAccountDomain.MaskIban(account.IBAN),
            Currency = account.Currency,
            CurrentBalance = account.CurrentBalance,
            IsActive = account.IsActive,
            LinkedAt = account.CreatedAt
        };
    }

    private static BeneficiaryDto ToBeneficiaryDto(Beneficiary beneficiary)
    {
        return new BeneficiaryDto
        {
            Id = beneficiary.Id,
            FullName = beneficiary.FullName,
            BankId = beneficiary.BankId,
            BankName = beneficiary.Bank?.Name ?? string.Empty,
            DestinationBankAccountId = beneficiary.DestinationBankAccountId,
            MaskedAccountReference = beneficiary.MaskedAccountReference,
            IsTrusted = beneficiary.IsTrusted
        };
    }

    private static string NormalizeAccountReference(string value)
    {
        return value.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
    }

    private static string Mask(string value)
    {
        var trimmed = value.Trim();
        var lastFour = trimmed.Length <= 4 ? trimmed : trimmed[^4..];
        return $"•••• {lastFour}";
    }
}
