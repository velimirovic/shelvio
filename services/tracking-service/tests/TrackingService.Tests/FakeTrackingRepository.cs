using TrackingService.API.Entities;
using TrackingService.API.Interfaces;

namespace TrackingService.Tests;

// In-memory zamena za pravi repozitorijum (EF Core + Postgres) - testira se POSLOVNA
// logika servisa, ne pristup bazi. Rucno pisan fake umesto mock biblioteke (Moq) -
// manje zavisnosti, ponasanje je eksplicitno vidljivo u kodu.
public class FakeTrackingRepository : ITrackingRepository
{
    public List<TrackingEntry> Entries { get; } = [];

    public Task<TrackingEntry?> GetByIdAsync(Guid id, Guid userId) =>
        Task.FromResult(Entries.FirstOrDefault(e => e.Id == id && e.UserId == userId));

    public Task<TrackingEntry?> GetByContentAsync(Guid userId, string contentType, string contentId) =>
        Task.FromResult(Entries.FirstOrDefault(e =>
            e.UserId == userId && e.ContentType == contentType && e.ContentId == contentId));

    public Task<List<TrackingEntry>> GetAllAsync(Guid userId, string? status) =>
        Task.FromResult(Entries
            .Where(e => e.UserId == userId && (status is null || e.Status == status))
            .ToList());

    public Task AddAsync(TrackingEntry entry)
    {
        Entries.Add(entry);
        return Task.CompletedTask;
    }

    public void Remove(TrackingEntry entry) => Entries.Remove(entry);

    public Task SaveChangesAsync() => Task.CompletedTask;
}
