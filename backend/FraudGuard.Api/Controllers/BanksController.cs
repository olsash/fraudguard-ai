using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/banks")]
public class BanksController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public BanksController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
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
}
