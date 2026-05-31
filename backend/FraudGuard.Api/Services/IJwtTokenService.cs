using FraudGuard.Api.Models;

namespace FraudGuard.Api.Services;

public interface IJwtTokenService
{
    string CreateToken(User user);
}
