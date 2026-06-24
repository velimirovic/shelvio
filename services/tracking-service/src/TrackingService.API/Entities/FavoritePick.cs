namespace TrackingService.API.Entities;

// Top 3 omiljena naslova PO TIPU sadrzaja (movie/series/book) - 3 odvojene rang-liste,
// svaka sa pozicijama 1-3. Referencira POSTOJECI TrackingEntry (bira se iz biblioteke,
// ne nova pretraga) - kad se TrackingEntry obrise, FK cascade automatski uklanja i pick.
public class FavoritePick
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    public string ContentType { get; set; } = string.Empty;

    // 1-3, redosled u top 3 (1 = najomiljenije).
    public int Position { get; set; }

    public Guid TrackingEntryId { get; set; }
    public TrackingEntry TrackingEntry { get; set; } = null!;
}
