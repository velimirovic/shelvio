using TrackingService.API.Entities;

namespace TrackingService.API.Interfaces;

public interface IFavoritePickRepository
{
    Task<List<FavoritePick>> GetAllAsync(Guid userId);
    Task<FavoritePick?> GetAsync(Guid userId, string contentType, int position);
    Task<FavoritePick?> GetByEntryAsync(Guid userId, string contentType, Guid trackingEntryId);
    Task AddAsync(FavoritePick pick);
    void Remove(FavoritePick pick);
    Task SaveChangesAsync();
}
