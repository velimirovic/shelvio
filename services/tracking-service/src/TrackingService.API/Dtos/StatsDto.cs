namespace TrackingService.API.Dtos;

public class GenreCountDto
{
    public string Genre { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class StatsDto
{
    public int TotalTitles { get; set; }
    public int PlanCount { get; set; }
    public int InProgressCount { get; set; }
    public int DoneCount { get; set; }

    // Broj stavki po tipu sadrzaja - koristi se za movies/series/books pie chart na frontu.
    public int MovieCount { get; set; }
    public int SeriesCount { get; set; }
    public int BookCount { get; set; }

    // Filmovi+serije, status=done, iz denormalizovanog DurationMinutes.
    public double HoursWatched { get; set; }

    // Knjige, status=done - broj, ne vreme (spec: "broj procitanih knjiga").
    public int BooksRead { get; set; }

    // Knjige, status=done, suma denormalizovanog Pages.
    public int PagesRead { get; set; }

    // Prosek SVIH ocenjenih stavki (bilo kog statusa/tipa) - null ako nista nije ocenjeno.
    public double? AverageRating { get; set; }

    // Decenija (npr. "2010s") sa najvise naslova, iz denormalizovanog Year - null ako
    // nijedna stavka nema godinu.
    public string? FavoriteDecade { get; set; }

    // Odvojeno po tipu sadrzaja (ne jedna mesana lista) - tacnije pokazuje ukus po tipu.
    public List<GenreCountDto> TopMovieGenres { get; set; } = [];
    public List<GenreCountDto> TopSeriesGenres { get; set; } = [];
    public List<GenreCountDto> TopBookGenres { get; set; } = [];
}
