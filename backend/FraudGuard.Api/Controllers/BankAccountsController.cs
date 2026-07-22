using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
[Route("api/bank-accounts")]
public class BankAccountsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ISystemLogService _systemLogService;

    public BankAccountsController(AppDbContext dbContext, ISystemLogService systemLogService)
    {
        _dbContext = dbContext;
        _systemLogService = systemLogService;
    }

    [HttpGet("my")]
    public async Task<ActionResult<IEnumerable<BankAccountDto>>> My(CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var accounts = await _dbContext.BankAccounts
            .AsNoTracking()
            .Include(account => account.Bank)
            .Where(account => account.UserId == userId.Value)
            .OrderByDescending(account => account.IsActive)
            .ThenByDescending(account => account.CreatedAt)
            .Select(account => ToDto(account))
            .ToListAsync(cancellationToken);

        return Ok(accounts);
    }

    [Authorize(Roles = ApplicationRoles.User)]
    [HttpPost]
    public ActionResult LegacyCreate()
    {
        return StatusCode(StatusCodes.Status410Gone, new { message = "Generated demo accounts are no longer supported. Use /api/bank-accounts/connect to verify a simulated existing account." });
    }

    [Authorize(Roles = ApplicationRoles.User)]
    [HttpPost("connect")]
    public async Task<ActionResult<BankAccountDto>> Connect(ConnectBankAccountRequest request, CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var accountNumber = BankAccountDomain.NormalizeAccountNumber(request.AccountNumber);
        var iban = BankAccountDomain.NormalizeIban(request.Iban);
        var holderName = BankAccountDomain.NormalizeHolderName(request.AccountHolderName);

        if (!BankAccountDomain.IsValidHolderName(request.AccountHolderName))
        {
            return BadRequest(new { message = "Account holder name is required." });
        }

        if (!BankAccountDomain.IsValidAccountNumber(accountNumber))
        {
            return BadRequest(new { message = "Account number has an invalid simulated format." });
        }

        if (!BankAccountDomain.IsValidIban(iban))
        {
            return BadRequest(new { message = "IBAN has an invalid simulated format." });
        }

        if (!BankAccountDomain.IsValidVerificationCode(request.VerificationCode))
        {
            return BadRequest(new { message = "Verification code must contain exactly 6 digits." });
        }

        var executionStrategy = _dbContext.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var dbTransaction = IsInMemoryDatabase()
                ? null
                : await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            var result = await ConnectCoreAsync(userId.Value, request, accountNumber, iban, holderName, cancellationToken);

            if (dbTransaction is not null)
            {
                await dbTransaction.CommitAsync(cancellationToken);
            }

            return result;
        });
    }

    private async Task<ActionResult<BankAccountDto>> ConnectCoreAsync(
        int userId,
        ConnectBankAccountRequest request,
        string accountNumber,
        string iban,
        string holderName,
        CancellationToken cancellationToken)
    {
        var lookupHash = BankAccountDomain.HashLookup(userId, request.BankId, accountNumber, iban);
        var recentAttemptCutoff = DateTime.UtcNow.Subtract(BankAccountDomain.VerificationAttemptWindow);
        var failedAttempts = await _dbContext.BankAccountVerificationAttempts.CountAsync(attempt =>
            attempt.UserId == userId
            && attempt.AccountLookupHash == lookupHash
            && attempt.AttemptedAt >= recentAttemptCutoff,
            cancellationToken);

        if (failedAttempts >= BankAccountDomain.MaxFailedVerificationAttempts)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new { message = "Too many failed verification attempts. Try again later." });
        }

        var activeCount = await _dbContext.BankAccounts
            .CountAsync(account => account.UserId == userId && account.IsActive, cancellationToken);

        if (activeCount >= BankAccountDomain.MaxActiveAccountsPerUser)
        {
            return BadRequest(new { message = "You have reached the maximum of 3 connected accounts." });
        }

        var demoAccount = await _dbContext.DemoBankAccounts
            .Include(account => account.Bank)
            .FirstOrDefaultAsync(account =>
                account.BankId == request.BankId
                && account.AccountNumber == accountNumber
                && account.Iban == iban,
                cancellationToken);

        if (demoAccount is null
            || !demoAccount.IsActive
            || demoAccount.IsLinked
            || demoAccount.LinkedUserId.HasValue
            || (demoAccount.DevelopmentUserId.HasValue && demoAccount.DevelopmentUserId.Value != userId)
            || BankAccountDomain.NormalizeHolderName(demoAccount.AccountHolderName) != holderName
            || !BankAccountDomain.VerifyCode(request.VerificationCode, demoAccount.VerificationCodeHash)
            || demoAccount.Bank is null
            || !demoAccount.Bank.IsActive)
        {
            _dbContext.BankAccountVerificationAttempts.Add(new BankAccountVerificationAttempt
            {
                UserId = userId,
                AccountLookupHash = lookupHash,
                AttemptedAt = DateTime.UtcNow
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _systemLogService.LogAsync("Warning", "profile", "Simulated bank account verification failed.", userId, null, cancellationToken);
            return BadRequest(new { message = "The bank account details could not be verified." });
        }

        demoAccount.IsLinked = true;
        demoAccount.LinkedUserId = userId;
        demoAccount.LinkedAt = DateTime.UtcNow;
        demoAccount.UpdatedAt = DateTime.UtcNow;

        var linkedAccount = BankAccountDomain.CreateLinkedAccount(userId, demoAccount);
        _dbContext.BankAccounts.Add(linkedAccount);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _systemLogService.LogAsync("Success", "profile", $"Simulated bank account connected for {demoAccount.Bank.Name}.", userId, null, cancellationToken);

        var created = await _dbContext.BankAccounts
            .AsNoTracking()
            .Include(item => item.Bank)
            .FirstAsync(item => item.Id == linkedAccount.Id, cancellationToken);

        return CreatedAtAction(nameof(My), new { id = linkedAccount.Id }, ToDto(created, demoAccount.LinkedAt));
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    internal static BankAccountDto ToDto(BankAccount account)
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

    private static BankAccountDto ToDto(BankAccount account, DateTime? linkedAt)
    {
        var dto = ToDto(account);
        dto.LinkedAt = linkedAt ?? dto.LinkedAt;
        return dto;
    }

    private bool IsInMemoryDatabase()
    {
        return _dbContext.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true;
    }
}
