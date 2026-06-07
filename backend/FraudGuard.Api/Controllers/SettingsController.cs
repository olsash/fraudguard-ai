using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public SettingsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPut("change-password")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Unauthorized(new { message = "Invalid or inactive account." });
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        if (BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "New password must be different from the current password." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Password changed successfully." });
    }

    [HttpDelete("account")]
    public async Task<ActionResult> DeleteAccount(CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Unauthorized(new { message = "Invalid or inactive account." });
        }

        if (user.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Admin accounts cannot be deleted from here." });
        }

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Account deleted successfully." });
    }

    private async Task<FraudGuard.Api.Models.User?> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId)
            ? await _dbContext.Users.FirstOrDefaultAsync(user => user.Id == userId, cancellationToken)
            : null;
    }
}
