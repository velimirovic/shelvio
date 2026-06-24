namespace TrackingService.API.Dtos;

public class TrackingEntryDto
{
    public Guid Id { get; set; }
    public string ContentId { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? PosterUrl { get; set; }
    public string? Year { get; set; }
    public List<string> Genres { get; set; } = [];
    public int? DurationMinutes { get; set; }
    public int? Pages { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? Rating { get; set; }
    public DateTime AddedAt { get; set; }
}
