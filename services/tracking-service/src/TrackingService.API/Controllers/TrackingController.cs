using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrackingService.API.Dtos;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Controllers;

[ApiController]
[Route("api/tracking")]
[Authorize]
public class TrackingController : ControllerBase
{
    private readonly ITrackingService _trackingService;

    public TrackingController(ITrackingService trackingService)
    {
        _trackingService = trackingService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    [HttpGet]
    public async Task<ActionResult<List<TrackingEntryDto>>> GetAll([FromQuery] string? status)
    {
        var result = await _trackingService.GetAllAsync(CurrentUserId, status);
        return Ok(result);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<StatsDto>> GetStats()
    {
        var result = await _trackingService.GetStatsAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpGet("{contentType}/{contentId}")]
    public async Task<ActionResult<TrackingEntryDto>> GetByContent(string contentType, string contentId)
    {
        var result = await _trackingService.GetByContentAsync(CurrentUserId, contentType, contentId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TrackingEntryDto>> Add(CreateTrackingEntryDto dto)
    {
        var result = await _trackingService.AddOrUpdateAsync(CurrentUserId, dto);
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TrackingEntryDto>> Update(Guid id, UpdateTrackingEntryDto dto)
    {
        var result = await _trackingService.UpdateAsync(CurrentUserId, id, dto);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _trackingService.DeleteAsync(CurrentUserId, id);
        return NoContent();
    }
}
