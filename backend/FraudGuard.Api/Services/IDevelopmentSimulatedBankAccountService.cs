using FraudGuard.Api.DTOs;

namespace FraudGuard.Api.Services;

public interface IDevelopmentSimulatedBankAccountService
{
    Task<DevelopmentSimulatedBankCredentialsDto> GetOrCreateCredentialsAsync(int currentUserId, int bankId, CancellationToken cancellationToken);
}
