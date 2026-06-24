using System.Net;
using TrackingService.API.Dtos;
using TrackingService.API.Entities;
using TrackingService.API.Exceptions;
using TrackingService.API.Interfaces;

namespace TrackingService.API.Services;

public class FavoritePickService : IFavoritePickService
{
    private const int MaxPosition = 3;

    private readonly IFavoritePickRepository _repository;
    private readonly ITrackingRepository _trackingRepository;

    public FavoritePickService(IFavoritePickRepository repository, ITrackingRepository trackingRepository)
    {
        _repository = repository;
        _trackingRepository = trackingRepository;
    }

    public async Task<List<FavoritePickDto>> GetAllAsync(Guid userId)
    {
        var picks = await _repository.GetAllAsync(userId);
        return picks.Select(ToDto).ToList();
    }

    public async Task<FavoritePickDto> SetAsync(Guid userId, string contentType, int position, Guid trackingEntryId)
    {
        if (position < 1 || position > MaxPosition)
        {
            throw new AppException($"Position must be between 1 and {MaxPosition}.", HttpStatusCode.BadRequest);
        }

        var entry = await _trackingRepository.GetByIdAsync(trackingEntryId, userId);

        if (entry is null)
        {
            throw new AppException("Tracking entry not found.", HttpStatusCode.NotFound);
        }

        if (entry.ContentType != contentType)
        {
            throw new AppException($"Tracking entry is not a '{contentType}'.", HttpStatusCode.BadRequest);
        }

        // Ista stavka ne moze biti na dve pozicije u istom top 3 - ako je vec negde
        // drugde u ovom tipu, premesti je (ukloni stari slot) umesto da se duplicira.
        var existingForEntry = await _repository.GetByEntryAsync(userId, contentType, trackingEntryId);

        if (existingForEntry is not null && existingForEntry.Position != position)
        {
            _repository.Remove(existingForEntry);
        }

        var slot = await _repository.GetAsync(userId, contentType, position);

        if (slot is null)
        {
            slot = new FavoritePick
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ContentType = contentType,
                Position = position,
                TrackingEntryId = trackingEntryId
            };

            await _repository.AddAsync(slot);
        }
        else
        {
            slot.TrackingEntryId = trackingEntryId;
        }

        await _repository.SaveChangesAsync();

        // Ponovo ucitaj da DTO ima svezu TrackingEntry navigaciju (slot.TrackingEntry
        // nije popunjen kada je slot bas kreiran u ovom pozivu).
        var saved = await _repository.GetAsync(userId, contentType, position);
        return ToDto(saved!);
    }

    public async Task ClearAsync(Guid userId, string contentType, int position)
    {
        var slot = await _repository.GetAsync(userId, contentType, position);

        if (slot is not null)
        {
            _repository.Remove(slot);
            await _repository.SaveChangesAsync();
        }
    }

    private static FavoritePickDto ToDto(FavoritePick pick) => new()
    {
        ContentType = pick.ContentType,
        Position = pick.Position,
        Entry = new TrackingEntryDto
        {
            Id = pick.TrackingEntry.Id,
            ContentId = pick.TrackingEntry.ContentId,
            ContentType = pick.TrackingEntry.ContentType,
            Title = pick.TrackingEntry.Title,
            PosterUrl = pick.TrackingEntry.PosterUrl,
            Year = pick.TrackingEntry.Year,
            Genres = pick.TrackingEntry.Genres,
            DurationMinutes = pick.TrackingEntry.DurationMinutes,
            Pages = pick.TrackingEntry.Pages,
            Status = pick.TrackingEntry.Status,
            Rating = pick.TrackingEntry.Rating,
            AddedAt = pick.TrackingEntry.AddedAt
        }
    };
}
