using TrackingService.API.Dtos;

namespace TrackingService.API.Interfaces;

public interface ITrackingService
{
    Task<TrackingEntryDto> AddOrUpdateAsync(Guid userId, CreateTrackingEntryDto dto);
    Task<TrackingEntryDto> UpdateAsync(Guid userId, Guid id, UpdateTrackingEntryDto dto);
    Task DeleteAsync(Guid userId, Guid id);
    Task<List<TrackingEntryDto>> GetAllAsync(Guid userId, string? status);
    Task<TrackingEntryDto?> GetByContentAsync(Guid userId, string contentType, string contentId);
    Task<StatsDto> GetStatsAsync(Guid userId);
}
