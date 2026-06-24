using Microsoft.EntityFrameworkCore;
using TrackingService.API.Data;
using TrackingService.API.Entities;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Repositories;

public class TrackingRepository : ITrackingRepository
{
    private readonly TrackingDbContext _context;

    public TrackingRepository(TrackingDbContext context)
    {
        _context = context;
    }

    public Task<TrackingEntry?> GetByIdAsync(Guid id, Guid userId) =>
        _context.TrackingEntries.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);

    public Task<TrackingEntry?> GetByContentAsync(Guid userId, string contentType, string contentId) =>
        _context.TrackingEntries.FirstOrDefaultAsync(e =>
            e.UserId == userId && e.ContentType == contentType && e.ContentId == contentId);

    public Task<List<TrackingEntry>> GetAllAsync(Guid userId, string? status)
    {
        var query = _context.TrackingEntries.Where(e => e.UserId == userId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(e => e.Status == status);
        }

        return query.OrderByDescending(e => e.AddedAt).ToListAsync();
    }

    public async Task AddAsync(TrackingEntry entry) =>
        await _context.TrackingEntries.AddAsync(entry);

    public void Remove(TrackingEntry entry) =>
        _context.TrackingEntries.Remove(entry);

    public Task SaveChangesAsync() =>
        _context.SaveChangesAsync();
}
