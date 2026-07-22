using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = ApplicationRoles.AdminOrFraudAnalyst + "," + ApplicationRoles.User)]
[Route("api/merchants")]
public class MerchantsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public MerchantsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("active")]
    public async Task<ActionResult<IEnumerable<MerchantDto>>> GetActive(
        [FromQuery] string? search,
        [FromQuery] string? category,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Merchants
            .AsNoTracking()
            .Include(merchant => merchant.Bank)
            .Where(merchant => merchant.IsActive && merchant.IsVerified);

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

        var merchants = await query
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
}
