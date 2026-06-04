using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FraudGuard.Api.Data;
using FraudGuard.Api.DTOs;
using FraudGuard.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/users")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public AdminUsersController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminUserDto>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _dbContext.Users
            .AsNoTracking()
            .OrderBy(user => user.FullName)
            .ToListAsync(cancellationToken);

        var stats = await LoadUserStats(cancellationToken);

        return Ok(users.Select(user => ToDto(user, stats)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminUserDetailsDto>> GetUser(int id, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var stats = await LoadUserStats(cancellationToken);
        var dto = ToDetailsDto(user, stats);
        dto.RecentPredictions = await _dbContext.Predictions
            .AsNoTracking()
            .Where(prediction => prediction.UserId == id)
            .OrderByDescending(prediction => prediction.CreatedAt)
            .Take(8)
            .Select(prediction => new RecentPredictionDto
            {
                Id = prediction.Id,
                UserId = prediction.UserId,
                UserEmail = user.Email,
                TransactionType = prediction.TransactionType,
                Amount = prediction.Amount,
                RiskScore = prediction.RiskScore,
                RiskLevel = prediction.RiskLevel,
                IsFraud = prediction.IsFraud,
                SuggestedAction = prediction.SuggestedAction,
                CreatedAt = prediction.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<AdminUserDto>> CreateUser(CreateAdminUserDto request, CancellationToken cancellationToken)
    {
        var role = NormalizeRole(request.Role);
        if (role is null)
        {
            return BadRequest(new { message = "Role must be User or Admin." });
        }

        var email = NormalizeEmail(request.Email);
        if (await _dbContext.Users.AnyAsync(user => user.Email == email, cancellationToken))
        {
            return Conflict(new { message = "Email is already registered." });
        }

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            PhoneNumber = NormalizeOptional(request.PhoneNumber),
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, ToDto(user, new Dictionary<int, UserPredictionStats>()));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminUserDto>> UpdateUser(int id, UpdateAdminUserDto request, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users.FindAsync([id], cancellationToken);
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        var role = NormalizeRole(request.Role);
        if (role is null)
        {
            return BadRequest(new { message = "Role must be User or Admin." });
        }

        var status = NormalizeStatus(request.Status);
        if (request.Status is not null && status is null)
        {
            return BadRequest(new { message = "Status must be Active or Inactive." });
        }

        var email = NormalizeEmail(request.Email);
        var emailExists = await _dbContext.Users
            .AnyAsync(item => item.Id != id && item.Email == email, cancellationToken);

        if (emailExists)
        {
            return Conflict(new { message = "Email is already registered." });
        }

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.PhoneNumber = NormalizeOptional(request.PhoneNumber);
        user.Role = role;
        user.IsActive = status is null ? user.IsActive : status == "Active";
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        var stats = await LoadUserStats(cancellationToken);
        return Ok(ToDto(user, stats));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == id)
        {
            return BadRequest(new { message = "You cannot delete your own account." });
        }

        var user = await _dbContext.Users.FindAsync([id], cancellationToken);
        if (user is null)
        {
            return NotFound(new { message = "User not found." });
        }

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<Dictionary<int, UserPredictionStats>> LoadUserStats(CancellationToken cancellationToken)
    {
        var stats = await _dbContext.Predictions
            .AsNoTracking()
            .GroupBy(prediction => prediction.UserId)
            .Select(group => new UserPredictionStats
            {
                UserId = group.Key,
                TotalPredictions = group.Count(),
                AverageRiskScore = group.Average(prediction => prediction.RiskScore),
                HighestRiskScore = group.Max(prediction => prediction.RiskScore),
                FraudPredictionsCount = group.Count(prediction => prediction.IsFraud)
            })
            .ToListAsync(cancellationToken);

        return stats.ToDictionary(item => item.UserId);
    }

    private int? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

        return int.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private static AdminUserDto ToDto(User user, IReadOnlyDictionary<int, UserPredictionStats> stats)
    {
        stats.TryGetValue(user.Id, out var userStats);

        return new AdminUserDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            PhoneNumber = user.PhoneNumber,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt,
            TotalPredictions = userStats?.TotalPredictions ?? 0,
            AverageRiskScore = Math.Round(userStats?.AverageRiskScore ?? 0, 1),
            HighestRiskScore = userStats?.HighestRiskScore ?? 0,
            FraudPredictionsCount = userStats?.FraudPredictionsCount ?? 0,
            Status = user.IsActive ? "Active" : "Inactive"
        };
    }

    private static AdminUserDetailsDto ToDetailsDto(User user, IReadOnlyDictionary<int, UserPredictionStats> stats)
    {
        var dto = ToDto(user, stats);

        return new AdminUserDetailsDto
        {
            Id = dto.Id,
            FullName = dto.FullName,
            Email = dto.Email,
            Role = dto.Role,
            PhoneNumber = dto.PhoneNumber,
            CreatedAt = dto.CreatedAt,
            LastLoginAt = dto.LastLoginAt,
            TotalPredictions = dto.TotalPredictions,
            AverageRiskScore = dto.AverageRiskScore,
            HighestRiskScore = dto.HighestRiskScore,
            FraudPredictionsCount = dto.FraudPredictionsCount,
            Status = dto.Status
        };
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeRole(string role)
    {
        return role.Trim().ToLowerInvariant() switch
        {
            "user" => "User",
            "admin" => "Admin",
            _ => null
        };
    }

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "Active",
            "inactive" => "Inactive",
            _ => null
        };
    }

    private sealed class UserPredictionStats
    {
        public int UserId { get; set; }

        public int TotalPredictions { get; set; }

        public double AverageRiskScore { get; set; }

        public int HighestRiskScore { get; set; }

        public int FraudPredictionsCount { get; set; }
    }
}
