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

public class AuthErrorResponse
{
    public string Code { get; set; } = string.Empty;

    public string? Field { get; set; }

    public string Message { get; set; } = string.Empty;
}
