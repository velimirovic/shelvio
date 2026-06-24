import { DecimalPipe, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { TrackingService } from '../../core/services/tracking.service';
import { ContentDetails, ContentItem, ContentType } from '../../core/models/content.models';
import { TrackingEntry, TrackingStatusValue } from '../../core/models/tracking.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

const ITEM_TYPE_LABELS: Record<ContentType, string> = {
  movie: 'film',
  series: 'series',
  book: 'book'
};

function statusOptionsFor(contentType: ContentType | undefined): { value: TrackingStatusValue; label: string }[] {
  return [
    { value: 'plan', label: 'Plan' },
    { value: 'in_progress', label: contentType === 'book' ? 'Reading' : 'Watching' },
    { value: 'done', label: 'Done' }
  ];
}

@Component({
  selector: 'app-detail',
  imports: [TopNavComponent, RouterLink, DecimalPipe],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss'
})
export class DetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly contentService = inject(ContentService);
  private readonly trackingService = inject(TrackingService);

  readonly statusOptions = computed(() => statusOptionsFor(this.content()?.contentType));
  readonly ratingScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly content = signal<ContentDetails | null>(null);
  readonly trackingEntry = signal<TrackingEntry | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly notFound = signal(false);

  readonly similarItems = signal<ContentItem[]>([]);
  readonly isLoadingSimilar = signal(false);

  // Plan = "jos nisam zapoceo", nema smisla oceniti nesto sto nije zapoceto/zavrseno.
  readonly canRate = computed(() => {
    const status = this.trackingEntry()?.status;
    return status === 'in_progress' || status === 'done';
  });

  readonly typeLabel = computed(() => {
    const content = this.content();
    return content ? ITEM_TYPE_LABELS[content.contentType] : '';
  });

  itemTypeLabel(type: ContentType): string {
    return ITEM_TYPE_LABELS[type];
  }

  readonly durationLabel = computed(() => {
    const minutes = this.content()?.durationMinutes;

    if (!minutes) {
      return null;
    }

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
  });

  ngOnInit(): void {
    // paramMap je Observable, ne samo snapshot - kad se klikne na drugi naslov sa ISTE
    // rute (/title/:type/:id -> /title/:type/:id), Angular ponovo iskoristi isti
    // komponentni instans (ne zove ngOnInit iznova), pa citanje snapshot-a SAMO jednom
    // ne bi primetilo promenu parametara. Pretplata ovde reaguje na SVAKU promenu.
    this.route.paramMap.subscribe((params) => {
      const type = params.get('type') as ContentType;
      const id = params.get('id')!;
      this.loadContent(type, id);
    });
  }

  private loadContent(type: ContentType, id: string): void {
    // Resetuj sve - bez ovoga bi se kratko vidio sadrzaj PRETHODNOG naslova dok se
    // novi ucitava (stari signali ostaju popunjeni do prvog next() odgovora).
    this.isLoading.set(true);
    this.notFound.set(false);
    this.content.set(null);
    this.trackingEntry.set(null);
    this.similarItems.set([]);

    this.contentService.getDetails(type, id).subscribe({
      next: (details) => {
        this.content.set(details);
        this.isLoading.set(false);
        this.loadTrackingEntry(type, id);
        // Knjige: autor (Hardcover nema "slicno" endpoint, pretraga po autoru je zamena).
        // Film/serija: hint se ignorise na backendu (TMDB recommendations ne trebaju ga).
        this.loadSimilar(type, id, details.author ?? undefined);
      },
      error: () => {
        this.isLoading.set(false);
        this.notFound.set(true);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  setStatus(status: TrackingStatusValue): void {
    const entry = this.trackingEntry();

    // Klik na vec aktivan status = ukloni sa liste (status ne moze biti "nista" dok
    // zapis postoji, pa "deselekcija" znaci brisanje celog zapisa).
    if (entry && entry.status === status) {
      this.remove(entry.id);
      return;
    }

    // Plan = "jos nisam zapoceo" - ne moze imati ocenu, makar je entry ranije imao
    // (npr. vracanje sa "Done" na "Plan" za re-watch/re-read).
    const rating = status === 'plan' ? null : entry?.rating ?? null;
    this.save(status, rating);
  }

  private remove(id: string): void {
    this.isSaving.set(true);

    this.trackingService.delete(id).subscribe({
      next: () => {
        this.trackingEntry.set(null);
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false)
    });
  }

  setRating(rating: number): void {
    const entry = this.trackingEntry();

    // Bez statusa (ili Plan) se ne moze oceniti - dugme je i vizuelno disabled za taj slucaj.
    if (!entry || entry.status === 'plan') {
      return;
    }

    // Klik na vec izabranu ocenu je je ponisti (toggle) - lakse od posebnog "clear" dugmeta.
    this.save(entry.status, entry.rating === rating ? null : rating);
  }

  private save(status: TrackingStatusValue, rating: number | null): void {
    const content = this.content();

    if (!content) {
      return;
    }

    this.isSaving.set(true);

    this.trackingService
      .addOrUpdate({
        contentId: content.contentId,
        contentType: content.contentType,
        title: content.title,
        posterUrl: content.posterUrl,
        year: content.year,
        genres: content.genres,
        durationMinutes: content.durationMinutes,
        pages: content.pages ?? null,
        status,
        rating
      })
      .subscribe({
        next: (entry) => {
          this.trackingEntry.set(entry);
          this.isSaving.set(false);
        },
        error: () => this.isSaving.set(false)
      });
  }

  private loadTrackingEntry(type: ContentType, id: string): void {
    this.trackingService.getByContent(type, id).subscribe({
      next: (entry) => this.trackingEntry.set(entry),
      error: () => this.trackingEntry.set(null)
    });
  }

  private loadSimilar(type: ContentType, id: string, hint?: string): void {
    this.isLoadingSimilar.set(true);

    this.contentService.getSimilar(type, id, hint).subscribe({
      next: (response) => {
        this.similarItems.set(response.results);
        this.isLoadingSimilar.set(false);
      },
      error: () => this.isLoadingSimilar.set(false)
    });
  }
}
