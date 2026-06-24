using Microsoft.EntityFrameworkCore;
using TrackingService.API.Data;
using TrackingService.API.Entities;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Repositories;

public class FavoritePickRepository : IFavoritePickRepository
{
    private readonly TrackingDbContext _context;

    public FavoritePickRepository(TrackingDbContext context)
    {
        _context = context;
    }

    public Task<List<FavoritePick>> GetAllAsync(Guid userId) =>
        _context.FavoritePicks
            .Include(p => p.TrackingEntry)
            .Where(p => p.UserId == userId)
            .OrderBy(p => p.ContentType)
            .ThenBy(p => p.Position)
            .ToListAsync();

    public Task<FavoritePick?> GetAsync(Guid userId, string contentType, int position) =>
        _context.FavoritePicks
            .Include(p => p.TrackingEntry)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.ContentType == contentType && p.Position == position);

    public Task<FavoritePick?> GetByEntryAsync(Guid userId, string contentType, Guid trackingEntryId) =>
        _context.FavoritePicks
            .FirstOrDefaultAsync(p => p.UserId == userId && p.ContentType == contentType && p.TrackingEntryId == trackingEntryId);

    public async Task AddAsync(FavoritePick pick) =>
        await _context.FavoritePicks.AddAsync(pick);

    public void Remove(FavoritePick pick) =>
        _context.FavoritePicks.Remove(pick);

    public Task SaveChangesAsync() =>
        _context.SaveChangesAsync();
}
