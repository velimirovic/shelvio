using TrackingService.API.Dtos;

namespace TrackingService.API.Interfaces;

public interface IFavoritePickService
{
    Task<List<FavoritePickDto>> GetAllAsync(Guid userId);
    Task<FavoritePickDto> SetAsync(Guid userId, string contentType, int position, Guid trackingEntryId);
    Task ClearAsync(Guid userId, string contentType, int position);
}
