using System.ComponentModel.DataAnnotations;

namespace TrackingService.API.Dtos;

public class CreateTrackingEntryDto
{
    [Required]
    public string ContentId { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(movie|series|book)$", ErrorMessage = "ContentType must be one of: movie, series, book.")]
    public string ContentType { get; set; } = string.Empty;

    [Required]
    public string Title { get; set; } = string.Empty;

    public string? PosterUrl { get; set; }
    public string? Year { get; set; }
    public List<string> Genres { get; set; } = [];
    public int? DurationMinutes { get; set; }
    public int? Pages { get; set; }

    [RegularExpression("^(plan|in_progress|done)$", ErrorMessage = "Status must be one of: plan, in_progress, done.")]
    public string Status { get; set; } = "plan";

    [Range(1, 10)]
    public int? Rating { get; set; }
}
