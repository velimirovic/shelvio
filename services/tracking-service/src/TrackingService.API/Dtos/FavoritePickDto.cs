namespace TrackingService.API.Dtos;

public class FavoritePickDto
{
    public string ContentType { get; set; } = string.Empty;
    public int Position { get; set; }
    public TrackingEntryDto Entry { get; set; } = null!;
}

public class SetFavoritePickDto
{
    public Guid TrackingEntryId { get; set; }
}
