using FraudGuard.Api.DTOs;
using FraudGuard.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FraudGuard.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/models")]
public class AdminModelsController : ControllerBase
{
    private readonly AdminModelService _modelService;
    private readonly ISystemLogService _systemLogService;

    public AdminModelsController(AdminModelService modelService, ISystemLogService systemLogService)
    {
        _modelService = modelService;
        _systemLogService = systemLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<AdminModelDto>>> GetModels(CancellationToken cancellationToken)
    {
        return await HandleAsync(() => _modelService.GetModelsAsync(cancellationToken));
    }

    [HttpGet("{modelId}")]
    public async Task<ActionResult<AdminModelDto>> GetModel(string modelId, CancellationToken cancellationToken)
    {
        return await HandleAsync(() => _modelService.GetModelAsync(modelId, cancellationToken));
    }

    [HttpPost("{modelId}/benchmark")]
    public Task<ActionResult<AdminModelDto>> Benchmark(string modelId, CancellationToken cancellationToken)
    {
        return RunActionAsync(modelId, "benchmark", "model benchmark completed", cancellationToken);
    }

    [HttpPost("{modelId}/retrain")]
    public Task<ActionResult<AdminModelDto>> Retrain(string modelId, CancellationToken cancellationToken)
    {
        return RunActionAsync(modelId, "retrain", "model retrained", cancellationToken);
    }

    [HttpPost("{modelId}/enable")]
    public Task<ActionResult<AdminModelDto>> Enable(string modelId, CancellationToken cancellationToken)
    {
        return RunActionAsync(modelId, "enable", "model enabled", cancellationToken);
    }

    [HttpPost("{modelId}/disable")]
    public Task<ActionResult<AdminModelDto>> Disable(string modelId, CancellationToken cancellationToken)
    {
        return RunActionAsync(modelId, "disable", "model disabled", cancellationToken);
    }

    [HttpPost("{modelId}/activate")]
    public Task<ActionResult<AdminModelDto>> Activate(string modelId, CancellationToken cancellationToken)
    {
        return RunActionAsync(modelId, "activate", "active model changed", cancellationToken);
    }

    private async Task<ActionResult<AdminModelDto>> RunActionAsync(
        string modelId,
        string action,
        string logMessage,
        CancellationToken cancellationToken)
    {
        await _systemLogService.LogAsync("Info", "admin", $"Admin model action started: {action} {modelId}.", cancellationToken: cancellationToken);
        var result = await HandleAsync(() => _modelService.RunActionAsync(modelId, action, cancellationToken));
        if (result.Result is null)
        {
            await _systemLogService.LogAsync("Success", "admin", $"Admin {logMessage}: {modelId}.", cancellationToken: cancellationToken);
        }

        return result;
    }

    private async Task<ActionResult<T>> HandleAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (AdminModelServiceException ex)
        {
            return StatusCode(ex.StatusCode, new { message = ex.Message });
        }
    }
}
