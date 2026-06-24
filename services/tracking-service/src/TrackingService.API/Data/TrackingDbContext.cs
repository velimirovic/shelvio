using Microsoft.EntityFrameworkCore;
using TrackingService.API.Entities;

namespace TrackingService.API.Data;

public class TrackingDbContext : DbContext
{
    public TrackingDbContext(DbContextOptions<TrackingDbContext> options) : base(options) { }

    public DbSet<TrackingEntry> TrackingEntries => Set<TrackingEntry>();
    public DbSet<FavoritePick> FavoritePicks => Set<FavoritePick>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TrackingEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ContentId).IsRequired().HasMaxLength(64);
            entity.Property(e => e.ContentType).IsRequired().HasMaxLength(16);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(512);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(16);

            // Genres se cuva kao Postgres text[] niz (Npgsql provider podrzava
            // List<string> nativno, bez potrebe za JSON konverzijom).
            entity.Property(e => e.Genres).IsRequired();

            // Jedan korisnik ne moze imati dva TrackingEntry-ja za istu stavku sadrzaja.
            entity.HasIndex(e => new { e.UserId, e.ContentId, e.ContentType }).IsUnique();
        });

        modelBuilder.Entity<FavoritePick>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ContentType).IsRequired().HasMaxLength(16);

            // Jedan slot (pozicija 1-3) po tipu sadrzaja po korisniku.
            entity.HasIndex(e => new { e.UserId, e.ContentType, e.Position }).IsUnique();

            // Ista stavka ne moze zauzimati dve pozicije u istom top 3 (DB-nivo garancija,
            // pored logike u servisu koja je svakako sprecava).
            entity.HasIndex(e => new { e.UserId, e.ContentType, e.TrackingEntryId }).IsUnique();

            // Brisanje TrackingEntry-ja (npr. deselekcija statusa na Detail ekranu)
            // automatski uklanja i favorite pick koji na njega pokazuje - nema "rupe"
            // koja bi pokazivala na obrisanu stavku.
            entity.HasOne(e => e.TrackingEntry)
                .WithMany()
                .HasForeignKey(e => e.TrackingEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
