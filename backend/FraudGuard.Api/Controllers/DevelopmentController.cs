using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Security;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = ApplicationRoles.User)]
[Route("api/development")]
public class DevelopmentController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;
    private readonly IDevelopmentSimulatedBankAccountService _simulatedBankAccountService;

    public DevelopmentController(
        IWebHostEnvironment environment,
        IDevelopmentSimulatedBankAccountService simulatedBankAccountService)
    {
        _environment = environment;
        _simulatedBankAccountService = simulatedBankAccountService;
    }

    [HttpGet("simulated-bank-credentials/{bankId:int}")]
    public async Task<IActionResult> GetSimulatedBankCredentials(int bankId, CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        try
        {
            var credentials = await _simulatedBankAccountService.GetOrCreateCredentialsAsync(userId.Value, bankId, cancellationToken);
            return Ok(credentials);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
