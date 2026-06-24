using System.Net;
using TrackingService.API.Dtos;
using TrackingService.API.Entities;
using TrackingService.API.Exceptions;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Services;

public class TrackingEntryService : ITrackingService
{
    private readonly ITrackingRepository _repository;

    public TrackingEntryService(ITrackingRepository repository)
    {
        _repository = repository;
    }

    public async Task<TrackingEntryDto> AddOrUpdateAsync(Guid userId, CreateTrackingEntryDto dto)
    {
        var existing = await _repository.GetByContentAsync(userId, dto.ContentType, dto.ContentId);

        if (existing is not null)
        {
            // Dodavanje istog sadrzaja drugi put = azuriranje (status/ocena/osvezeni
            // prikazni podaci), ne duplikat - korisnik je vec pratio ovu stavku.
            existing.Title = dto.Title;
            existing.PosterUrl = dto.PosterUrl;
            existing.Year = dto.Year;
            existing.Genres = dto.Genres;
            existing.DurationMinutes = dto.DurationMinutes;
            existing.Pages = dto.Pages;
            existing.Status = dto.Status;
            existing.Rating = dto.Rating;

            await _repository.SaveChangesAsync();
            return ToDto(existing);
        }

        var entry = new TrackingEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ContentId = dto.ContentId,
            ContentType = dto.ContentType,
            Title = dto.Title,
            PosterUrl = dto.PosterUrl,
            Year = dto.Year,
            Genres = dto.Genres,
            DurationMinutes = dto.DurationMinutes,
            Pages = dto.Pages,
            Status = dto.Status,
            Rating = dto.Rating,
            AddedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(entry);
        await _repository.SaveChangesAsync();

        return ToDto(entry);
    }

    public async Task<TrackingEntryDto> UpdateAsync(Guid userId, Guid id, UpdateTrackingEntryDto dto)
    {
        var entry = await _repository.GetByIdAsync(id, userId);

        if (entry is null)
        {
            throw new AppException("Tracking entry not found.", HttpStatusCode.NotFound);
        }

        entry.Status = dto.Status;
        entry.Rating = dto.Rating;

        await _repository.SaveChangesAsync();

        return ToDto(entry);
    }

    public async Task DeleteAsync(Guid userId, Guid id)
    {
        var entry = await _repository.GetByIdAsync(id, userId);

        if (entry is null)
        {
            throw new AppException("Tracking entry not found.", HttpStatusCode.NotFound);
        }

        _repository.Remove(entry);
        await _repository.SaveChangesAsync();
    }

    public async Task<List<TrackingEntryDto>> GetAllAsync(Guid userId, string? status)
    {
        var entries = await _repository.GetAllAsync(userId, status);
        return entries.Select(ToDto).ToList();
    }

    public async Task<TrackingEntryDto?> GetByContentAsync(Guid userId, string contentType, string contentId)
    {
        var entry = await _repository.GetByContentAsync(userId, contentType, contentId);
        return entry is null ? null : ToDto(entry);
    }

    public async Task<StatsDto> GetStatsAsync(Guid userId)
    {
        var entries = await _repository.GetAllAsync(userId, status: null);

        var hoursWatched = entries
            .Where(e => e.Status == TrackingStatus.Done && e.ContentType is "movie" or "series" && e.DurationMinutes.HasValue)
            .Sum(e => e.DurationMinutes!.Value) / 60.0;

        var booksRead = entries.Count(e => e.Status == TrackingStatus.Done && e.ContentType == "book");

        var pagesRead = entries
            .Where(e => e.Status == TrackingStatus.Done && e.ContentType == "book" && e.Pages.HasValue)
            .Sum(e => e.Pages!.Value);

        var ratedEntries = entries.Where(e => e.Rating.HasValue).ToList();
        double? averageRating = ratedEntries.Count > 0 ? Math.Round(ratedEntries.Average(e => e.Rating!.Value), 1) : null;

        string? favoriteDecade = entries
            .Where(e => int.TryParse(e.Year, out _))
            .GroupBy(e => (int.Parse(e.Year!) / 10) * 10)
            .OrderByDescending(g => g.Count())
            .Select(g => $"{g.Key}s")
            .FirstOrDefault();

        List<GenreCountDto> TopGenresFor(string contentType) =>
            entries
                .Where(e => e.ContentType == contentType)
                .SelectMany(e => e.Genres)
                .GroupBy(g => g)
                .Select(g => new GenreCountDto { Genre = g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .Take(5)
                .ToList();

        return new StatsDto
        {
            TotalTitles = entries.Count,
            PlanCount = entries.Count(e => e.Status == TrackingStatus.Plan),
            InProgressCount = entries.Count(e => e.Status == TrackingStatus.InProgress),
            DoneCount = entries.Count(e => e.Status == TrackingStatus.Done),
            MovieCount = entries.Count(e => e.ContentType == "movie"),
            SeriesCount = entries.Count(e => e.ContentType == "series"),
            BookCount = entries.Count(e => e.ContentType == "book"),
            HoursWatched = Math.Round(hoursWatched, 1),
            BooksRead = booksRead,
            PagesRead = pagesRead,
            AverageRating = averageRating,
            FavoriteDecade = favoriteDecade,
            TopMovieGenres = TopGenresFor("movie"),
            TopSeriesGenres = TopGenresFor("series"),
            TopBookGenres = TopGenresFor("book")
        };
    }

    private static TrackingEntryDto ToDto(TrackingEntry entry) => new()
    {
        Id = entry.Id,
        ContentId = entry.ContentId,
        ContentType = entry.ContentType,
        Title = entry.Title,
        PosterUrl = entry.PosterUrl,
        Year = entry.Year,
        Genres = entry.Genres,
        DurationMinutes = entry.DurationMinutes,
        Pages = entry.Pages,
        Status = entry.Status,
        Rating = entry.Rating,
        AddedAt = entry.AddedAt
    };
}
