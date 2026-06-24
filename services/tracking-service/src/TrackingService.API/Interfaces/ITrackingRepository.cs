using TrackingService.API.Entities;

namespace TrackingService.API.Interfaces;

public interface ITrackingRepository
{
    Task<TrackingEntry?> GetByIdAsync(Guid id, Guid userId);
    Task<TrackingEntry?> GetByContentAsync(Guid userId, string contentType, string contentId);
    Task<List<TrackingEntry>> GetAllAsync(Guid userId, string? status);
    Task AddAsync(TrackingEntry entry);
    void Remove(TrackingEntry entry);
    Task SaveChangesAsync();
}
