using System.ComponentModel.DataAnnotations;

namespace TrackingService.API.Dtos;

public class UpdateTrackingEntryDto
{
    [Required]
    [RegularExpression("^(plan|in_progress|done)$", ErrorMessage = "Status must be one of: plan, in_progress, done.")]
    public string Status { get; set; } = string.Empty;

    [Range(1, 10)]
    public int? Rating { get; set; }
}
