using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrackingService.API.Dtos;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Controllers;

// Nested pod /api/tracking (ne sopstveni prefix) - poklapa se sa postojecom Gateway
// YARP rutom "/api/tracking/{**catch-all}", bez potrebe za izmenom Gateway konfiguracije.
[ApiController]
[Route("api/tracking/favorites")]
[Authorize]
public class FavoritePicksController : ControllerBase
{
    private readonly IFavoritePickService _favoritePickService;

    public FavoritePicksController(IFavoritePickService favoritePickService)
    {
        _favoritePickService = favoritePickService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    [HttpGet]
    public async Task<ActionResult<List<FavoritePickDto>>> GetAll()
    {
        var result = await _favoritePickService.GetAllAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpPut("{contentType}/{position:int}")]
    public async Task<ActionResult<FavoritePickDto>> Set(string contentType, int position, SetFavoritePickDto dto)
    {
        var result = await _favoritePickService.SetAsync(CurrentUserId, contentType, position, dto.TrackingEntryId);
        return Ok(result);
    }

    [HttpDelete("{contentType}/{position:int}")]
    public async Task<IActionResult> Clear(string contentType, int position)
    {
        await _favoritePickService.ClearAsync(CurrentUserId, contentType, position);
        return NoContent();
    }
}
