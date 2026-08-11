import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TrackingService } from '../../core/services/tracking.service';
import { Recommendation, RecommendationFilter, RecommendationsResponse } from '../../core/models/tracking.models';
import { ContentType } from '../../core/models/content.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

const FILTERS: { value: RecommendationFilter; label: string }[] = [
  { value: 'all',    label: 'Everything' },
  { value: 'movie',  label: 'Movies'     },
  { value: 'series', label: 'Series'     },
  { value: 'book',   label: 'Books'      },
];

const TYPE_LABELS: Record<ContentType, string> = {
  movie: 'film', series: 'series', book: 'book',
};

const MAX_HISTORY = 15;

export interface HistoryEntry {
  filter: RecommendationFilter;
  generatedAt: string;
  recommendations: Recommendation[];
}

@Component({
  selector: 'app-recommendations',
  imports: [TopNavComponent, RouterLink, DatePipe],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.scss',
})
export class RecommendationsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly trackingService = inject(TrackingService);

  private get _historyKey(): string {
    const uid = this.authService.currentUser()?.id ?? 'anon';
    return `shelvio_rec_history_${uid}`;
  }

  readonly filters = FILTERS;

  // Filter is only a selection for the NEXT generate — it never changes displayed results.
  readonly activeFilter = signal<RecommendationFilter>('all');
  readonly current = signal<HistoryEntry | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly activeHistoryIndex = signal<number | null>(null);
  readonly generationsRemaining = signal<number | null>(null);
  readonly dailyLimit = signal(3);

  readonly recommendations = computed(() => this.current()?.recommendations ?? []);
  readonly generatedAt = computed(() => this.current()?.generatedAt ?? null);
  readonly hasResult = computed(() => this.recommendations().length > 0);
  readonly canGenerate = computed(() => {
    const rem = this.generationsRemaining();
    return rem === null || rem > 0;
  });
  readonly dailyDots = computed(() =>
    Array.from({ length: this.dailyLimit() }, (_, i) => i)
  );

  ngOnInit(): void {
    this.history.set(this._loadHistory());
    // No auto-load — user always sees the empty state on arrival.
    // Past results are accessible via the history sidebar.
  }

  setFilter(filter: RecommendationFilter): void {
    this.activeFilter.set(filter);
    // Intentionally does NOT load from cache or clear displayed results.
    // The filter is purely a selector for the next generate call.
  }

  generate(): void {
    if (!this.canGenerate()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.activeHistoryIndex.set(null);

    this.trackingService.getRecommendations(this.activeFilter(), true).subscribe({
      next: (res) => {
        const entry: HistoryEntry = {
          filter: this.activeFilter(),
          generatedAt: res.generatedAt,
          recommendations: res.recommendations,
        };
        this.current.set(entry);
        this._prependHistory(entry);
        this.generationsRemaining.set(res.generationsRemaining ?? null);
        this.dailyLimit.set(res.dailyLimit ?? 3);
        this.isLoading.set(false);
      },
      error: (err) => {
        const detail = err?.error?.detail;
        if (err?.status === 429 && detail?.generationsRemaining !== undefined) {
          this.generationsRemaining.set(0);
          this.errorMessage.set(`Daily limit reached — resets at midnight UTC.`);
        } else {
          this.errorMessage.set(typeof detail === 'string' ? detail : 'Something went wrong. Try again later.');
        }
        this.isLoading.set(false);
      },
    });
  }

  loadHistoryEntry(entry: HistoryEntry, index: number): void {
    this.current.set(entry);
    this.activeHistoryIndex.set(index);
    this.errorMessage.set(null);
    // Does NOT change activeFilter — filter stays as the user's next-generate selection.
  }

  typeLabel(type: ContentType): string { return TYPE_LABELS[type]; }

  filterLabel(filter: RecommendationFilter): string {
    return FILTERS.find(f => f.value === filter)?.label ?? filter;
  }

  detailRoute(rec: Recommendation): string[] {
    return ['/title', rec.contentType, rec.contentId!];
  }

  private _tryRestoreCache(): void {
    this.trackingService.getRecommendations('all', false).subscribe({
      next: (res) => {
        if (res.recommendations?.length && !this.current()) {
          this.current.set({ filter: 'all', generatedAt: res.generatedAt, recommendations: res.recommendations });
        }
      },
      error: () => {},
    });
  }

  private _prependHistory(entry: HistoryEntry): void {
    const updated = [entry, ...this._loadHistory()].slice(0, MAX_HISTORY);
    localStorage.setItem(this._historyKey, JSON.stringify(updated));
    this.history.set(updated);
  }

  private _loadHistory(): HistoryEntry[] {
    try { return JSON.parse(localStorage.getItem(this._historyKey) ?? '[]'); }
    catch { return []; }
  }
}
