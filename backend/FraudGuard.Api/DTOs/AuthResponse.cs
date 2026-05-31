namespace FraudGuard.Api.DTOs;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;

    public AuthUserDto User { get; set; } = new();
}

public class AuthUserDto
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;
}
