using System.Net;
using TrackingService.API.Dtos;
using TrackingService.API.Entities;
using TrackingService.API.Exceptions;
using TrackingService.API.Services;

namespace TrackingService.Tests;

public class TrackingEntryServiceTests
{
    private static readonly Guid UserId = Guid.NewGuid();

    private readonly FakeTrackingRepository _repository = new();
    private readonly TrackingEntryService _service;

    public TrackingEntryServiceTests()
    {
        _service = new TrackingEntryService(_repository);
    }

    private TrackingEntry Seed(
        string contentType,
        string status,
        string contentId = "",
        int? durationMinutes = null,
        int? pages = null,
        int? rating = null,
        string? year = null,
        List<string>? genres = null,
        Guid? userId = null)
    {
        var entry = new TrackingEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId ?? UserId,
            ContentId = contentId.Length > 0 ? contentId : Guid.NewGuid().ToString(),
            ContentType = contentType,
            Title = "Test title",
            Status = status,
            DurationMinutes = durationMinutes,
            Pages = pages,
            Rating = rating,
            Year = year,
            Genres = genres ?? [],
            AddedAt = DateTime.UtcNow
        };

        _repository.Entries.Add(entry);
        return entry;
    }

    // ─── GetStatsAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Stats_HoursWatched_CountsOnlyDoneMoviesAndSeriesWithDuration()
    {
        Seed("movie", TrackingStatus.Done, durationMinutes: 148);
        Seed("series", TrackingStatus.Done, durationMinutes: 300);
        Seed("movie", TrackingStatus.InProgress, durationMinutes: 120); // nije done - ne racuna se
        Seed("movie", TrackingStatus.Done);                             // nema trajanje - ne racuna se
        Seed("book", TrackingStatus.Done, pages: 400);                  // knjiga - ne racuna se u sate

        var stats = await _service.GetStatsAsync(UserId);

        // (148 + 300) / 60 = 7.4666... -> zaokruzeno na 1 decimalu
        Assert.Equal(7.5, stats.HoursWatched);
    }

    [Fact]
    public async Task Stats_BooksAndPagesRead_CountOnlyDoneBooks()
    {
        Seed("book", TrackingStatus.Done, pages: 401);
        Seed("book", TrackingStatus.Done); // bez broja strana - broji se knjiga, ne strane
        Seed("book", TrackingStatus.Plan, pages: 999);
        Seed("movie", TrackingStatus.Done, durationMinutes: 100);

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Equal(2, stats.BooksRead);
        Assert.Equal(401, stats.PagesRead);
    }

    [Fact]
    public async Task Stats_AverageRating_IncludesAllRatedEntriesRegardlessOfStatusAndType()
    {
        Seed("movie", TrackingStatus.Done, rating: 10);
        Seed("book", TrackingStatus.InProgress, rating: 9);
        Seed("series", TrackingStatus.Plan); // neocenjeno - ne ulazi u prosek

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Equal(9.5, stats.AverageRating);
    }

    [Fact]
    public async Task Stats_AverageRating_IsNullWhenNothingIsRated()
    {
        Seed("movie", TrackingStatus.Done, durationMinutes: 100);

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Null(stats.AverageRating);
    }

    [Fact]
    public async Task Stats_FavoriteDecade_GroupsParsableYearsByDecade()
    {
        Seed("movie", TrackingStatus.Done, year: "2014");
        Seed("movie", TrackingStatus.Plan, year: "2017");
        Seed("book", TrackingStatus.Done, year: "1999");
        Seed("series", TrackingStatus.Done, year: null);          // bez godine - ignorise se
        Seed("series", TrackingStatus.Done, year: "not-a-year");  // neparsirljivo - ignorise se

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Equal("2010s", stats.FavoriteDecade);
    }

    [Fact]
    public async Task Stats_FavoriteDecade_IsNullWhenNoEntryHasParsableYear()
    {
        Seed("movie", TrackingStatus.Done, year: null);

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Null(stats.FavoriteDecade);
    }

    [Fact]
    public async Task Stats_TopGenres_AreSeparatedByContentTypeAndOrderedByCount()
    {
        Seed("movie", TrackingStatus.Done, genres: ["Sci-Fi", "Drama"]);
        Seed("movie", TrackingStatus.Plan, genres: ["Sci-Fi"]);
        Seed("book", TrackingStatus.Done, genres: ["Fantasy"]);

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Equal("Sci-Fi", stats.TopMovieGenres[0].Genre);
        Assert.Equal(2, stats.TopMovieGenres[0].Count);
        Assert.Equal(["Fantasy"], stats.TopBookGenres.Select(g => g.Genre));
        Assert.Empty(stats.TopSeriesGenres);
    }

    [Fact]
    public async Task Stats_Counts_AreScopedToTheRequestingUser()
    {
        Seed("movie", TrackingStatus.Done);
        Seed("book", TrackingStatus.Plan);
        Seed("movie", TrackingStatus.Done, userId: Guid.NewGuid()); // tudja stavka

        var stats = await _service.GetStatsAsync(UserId);

        Assert.Equal(2, stats.TotalTitles);
        Assert.Equal(1, stats.DoneCount);
        Assert.Equal(1, stats.PlanCount);
        Assert.Equal(1, stats.MovieCount);
        Assert.Equal(1, stats.BookCount);
    }

    // ─── AddOrUpdateAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task AddOrUpdate_SecondAddOfSameContent_UpdatesInsteadOfDuplicating()
    {
        var dto = new CreateTrackingEntryDto
        {
            ContentId = "603",
            ContentType = "movie",
            Title = "The Matrix",
            Status = TrackingStatus.Plan
        };

        await _service.AddOrUpdateAsync(UserId, dto);

        dto.Status = TrackingStatus.Done;
        dto.Rating = 10;
        var result = await _service.AddOrUpdateAsync(UserId, dto);

        Assert.Single(_repository.Entries);
        Assert.Equal(TrackingStatus.Done, result.Status);
        Assert.Equal(10, result.Rating);
    }

    [Fact]
    public async Task AddOrUpdate_SameContentForDifferentUsers_CreatesSeparateEntries()
    {
        var dto = new CreateTrackingEntryDto { ContentId = "603", ContentType = "movie", Title = "The Matrix" };

        await _service.AddOrUpdateAsync(UserId, dto);
        await _service.AddOrUpdateAsync(Guid.NewGuid(), dto);

        Assert.Equal(2, _repository.Entries.Count);
    }

    // ─── UpdateAsync / DeleteAsync - user scoping ───────────────────────────────

    [Fact]
    public async Task Update_EntryOfAnotherUser_ThrowsNotFound()
    {
        var foreignEntry = Seed("movie", TrackingStatus.Plan, userId: Guid.NewGuid());
        var dto = new UpdateTrackingEntryDto { Status = TrackingStatus.Done };

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.UpdateAsync(UserId, foreignEntry.Id, dto));

        Assert.Equal(HttpStatusCode.NotFound, ex.StatusCode);
    }

    [Fact]
    public async Task Delete_EntryOfAnotherUser_ThrowsNotFoundAndDoesNotDelete()
    {
        var foreignEntry = Seed("movie", TrackingStatus.Plan, userId: Guid.NewGuid());

        await Assert.ThrowsAsync<AppException>(() => _service.DeleteAsync(UserId, foreignEntry.Id));

        Assert.Single(_repository.Entries);
    }
}
