namespace TrackingService.API.Entities;

public static class TrackingStatus
{
    public const string Plan = "plan";
    public const string InProgress = "in_progress";
    public const string Done = "done";

    public static readonly string[] All = [Plan, InProgress, Done];
}

public class TrackingEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    // contentId je spoljni identifikator (TMDB id za movie/series, Open Library work
    // key za book) - isti kljuc koji vraca Content Service, bez ikakve sinhronizacije.
    public string ContentId { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;

    // Denormalizovani prikazni podaci - frontend ih prosledjuje pri dodavanju na listu
    // (vec ih ima sa Detail stranice), da Tracking Service ne mora da zove Content
    // Service za svaki prikaz liste/statistike.
    public string Title { get; set; } = string.Empty;
    public string? PosterUrl { get; set; }
    public string? Year { get; set; }
    public List<string> Genres { get; set; } = [];
    public int? DurationMinutes { get; set; }

    // Samo za knjige - isti princip kao DurationMinutes za filmove/serije ("pages read" stat).
    public int? Pages { get; set; }

    public string Status { get; set; } = TrackingStatus.Plan;
    public int? Rating { get; set; }

    public DateTime AddedAt { get; set; }
}
