import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TrackingService } from '../../core/services/tracking.service';
import { FavoritePick, TrackingEntry, TrackingStatusValue } from '../../core/models/tracking.models';
import { ContentType } from '../../core/models/content.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

type StatusFilter = 'all' | TrackingStatusValue;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'plan', label: 'plan' },
  { value: 'in_progress', label: 'in progress' },
  { value: 'done', label: 'done' }
];

const ITEM_TYPE_LABELS: Record<ContentType, string> = {
  movie: 'film',
  series: 'series',
  book: 'book'
};

// "series" je vec mnozina (ne "seriess") - obican +s sufiks ne radi za sva tri tipa.
const ITEM_TYPE_PLURAL_LABELS: Record<ContentType, string> = {
  movie: 'movies',
  series: 'series',
  book: 'books'
};

const FAVORITE_SECTIONS: { type: ContentType; label: string }[] = [
  { type: 'movie', label: 'top movies' },
  { type: 'series', label: 'top series' },
  { type: 'book', label: 'top books' }
];

const TOP_SLOTS = [1, 2, 3];

@Component({
  selector: 'app-library',
  imports: [TopNavComponent, RouterLink, ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './library.component.html',
  styleUrl: './library.component.scss'
})
export class LibraryComponent implements OnInit {
  private readonly trackingService = inject(TrackingService);

  readonly filters = FILTERS;
  readonly favoriteSections = FAVORITE_SECTIONS;
  readonly topSlots = TOP_SLOTS;

  readonly statusFilter = signal<StatusFilter>('all');
  readonly searchControl = new FormControl('', { nonNullable: true });
  // computed() prati samo SIGNALE, ne FormControl.value direktno (citanje plain
  // propertyja ne registruje zavisnost) - zato se vrednost gura u signal preko
  // valueChanges, isti razlog zbog kog pretraga "nije reagovala" na kucanje.
  readonly searchQuery = signal('');
  readonly pickerSearchControl = new FormControl('', { nonNullable: true });
  readonly pickerSearchQuery = signal('');

  readonly entries = signal<TrackingEntry[]>([]);
  readonly favoritePicks = signal<FavoritePick[]>([]);
  readonly isLoading = signal(true);

  // Picker modal je otvoren za TACNO jedan slot u isto vreme.
  readonly pickerTarget = signal<{ contentType: ContentType; position: number } | null>(null);
  readonly isSavingPick = signal(false);

  constructor() {
    this.searchControl.valueChanges.subscribe((value) => this.searchQuery.set(value));
    this.pickerSearchControl.valueChanges.subscribe((value) => this.pickerSearchQuery.set(value));
  }

  // Pretraga je SKOPIRANA na trenutni status filter - "plan" tab pretrazuje samo
  // medju planiranim, ne kroz celu biblioteku (kako je trazeno).
  readonly filteredEntries = computed(() => {
    const filter = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();

    let result = filter === 'all' ? this.entries() : this.entries().filter((e) => e.status === filter);

    if (query) {
      result = result.filter((e) => e.title.toLowerCase().includes(query));
    }

    return result;
  });

  readonly counts = computed(() => ({
    all: this.entries().length,
    plan: this.entries().filter((e) => e.status === 'plan').length,
    in_progress: this.entries().filter((e) => e.status === 'in_progress').length,
    done: this.entries().filter((e) => e.status === 'done').length
  }));

  // Slotovi 1-3 po tipu - null gde nema picka (prazan slot).
  readonly favoritesByType = computed(() => {
    const picks = this.favoritePicks();
    const result: Record<ContentType, (FavoritePick | null)[]> = { movie: [], series: [], book: [] };

    for (const section of FAVORITE_SECTIONS) {
      result[section.type] = TOP_SLOTS.map(
        (position) => picks.find((p) => p.contentType === section.type && p.position === position) ?? null
      );
    }

    return result;
  });

  // Kandidati za picker - stavke ISTOG tipa koje JOS NISU u top 3 za taj tip
  // (sprecava da ista stavka zavrsi na dve pozicije - jednostavnije od "move" UI-ja),
  // dodatno filtrirano picker-ovom sopstvenom pretragom.
  readonly pickerCandidates = computed(() => {
    const target = this.pickerTarget();

    if (!target) {
      return [];
    }

    const usedIds = new Set(
      this.favoritePicks()
        .filter((p) => p.contentType === target.contentType)
        .map((p) => p.entry.id)
    );

    const query = this.pickerSearchQuery().trim().toLowerCase();

    return this.entries().filter(
      (e) =>
        e.contentType === target.contentType &&
        !usedIds.has(e.id) &&
        (!query || e.title.toLowerCase().includes(query))
    );
  });

  ngOnInit(): void {
    this.trackingService.getAll().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.trackingService.getFavoritePicks().subscribe({
      next: (picks) => this.favoritePicks.set(picks)
    });
  }

  setFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  statusLabel(entry: TrackingEntry): string {
    if (entry.status === 'plan') return 'plan';
    if (entry.status === 'done') return 'done';
    return entry.contentType === 'book' ? 'reading' : 'watching';
  }

  itemTypeLabel(type: ContentType): string {
    return ITEM_TYPE_LABELS[type];
  }

  itemTypePluralLabel(type: ContentType): string {
    return ITEM_TYPE_PLURAL_LABELS[type];
  }

  openPicker(contentType: ContentType, position: number): void {
    this.pickerTarget.set({ contentType, position });
    this.pickerSearchControl.setValue('');
  }

  closePicker(): void {
    this.pickerTarget.set(null);
  }

  selectCandidate(entry: TrackingEntry): void {
    const target = this.pickerTarget();

    if (!target) {
      return;
    }

    this.isSavingPick.set(true);

    this.trackingService.setFavoritePick(target.contentType, target.position, entry.id).subscribe({
      next: (pick) => {
        const next = this.favoritePicks().filter(
          (p) => !(p.contentType === pick.contentType && p.position === pick.position)
        );
        this.favoritePicks.set([...next, pick]);
        this.isSavingPick.set(false);
        this.closePicker();
      },
      error: () => this.isSavingPick.set(false)
    });
  }

  clearFavorite(contentType: ContentType, position: number): void {
    this.trackingService.clearFavoritePick(contentType, position).subscribe({
      next: () => {
        this.favoritePicks.set(
          this.favoritePicks().filter((p) => !(p.contentType === contentType && p.position === position))
        );
      }
    });
  }
}
