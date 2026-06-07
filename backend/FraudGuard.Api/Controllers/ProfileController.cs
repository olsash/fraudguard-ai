using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ProfileController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("me")]
    public async Task<ActionResult<ProfileResponse>> Me(CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(cancellationToken);

        if (user is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        return Ok(ToResponse(user));
    }

    [HttpPut("me")]
    public async Task<ActionResult<ProfileResponse>> UpdateMe(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await GetCurrentUserAsync(cancellationToken);

        if (user is null)
        {
            return Unauthorized(new { message = "Invalid token." });
        }

        var fullName = request.FullName.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return BadRequest(new { message = "Full name is required." });
        }

        user.FullName = fullName;
        user.PhoneNumber = NormalizeOptional(request.PhoneNumber);
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(user));
    }

    private async Task<User?> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!int.TryParse(userIdValue, out var userId))
        {
            return null;
        }

        return await _dbContext.Users.FindAsync([userId], cancellationToken);
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static ProfileResponse ToResponse(User user)
    {
        return new ProfileResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            PhoneNumber = user.PhoneNumber,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastLoginAt = user.LastLoginAt
        };
    }
}
