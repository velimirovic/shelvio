import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, share, switchMap } from 'rxjs';
import { ContentService } from '../../core/services/content.service';
import { ContentItem, ContentType, SearchResponse } from '../../core/models/content.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

type Category = 'all' | ContentType;

// Razmak izmedju kartica - mora da se poklapa sa search.component.scss.
const ROW_ITEM_GAP = 18;
const TARGET_VISIBLE_COUNT = 6;
const MIN_ITEM_WIDTH = 110;
const MAX_ITEM_WIDTH = 200;

const ITEM_TYPE_LABELS: Record<ContentType, string> = {
  movie: 'film',
  series: 'series',
  book: 'book'
};

const EMPTY_RESPONSE: SearchResponse = { query: '', count: 0, results: [] };

@Component({
  selector: 'app-search',
  imports: [ReactiveFormsModule, TopNavComponent, DecimalPipe, NgTemplateOutlet],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent implements OnInit {
  private readonly contentService = inject(ContentService);
  private readonly hostElement = inject(ElementRef<HTMLElement>).nativeElement;

  // Trenutno izracunata sirina kartice (azurira se u fitAllRows).
  private currentItemWidth = MIN_ITEM_WIDTH;

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly category = signal<Category>('all');
  readonly hasSearched = signal(false);

  readonly movieResults = signal<ContentItem[]>([]);
  readonly seriesResults = signal<ContentItem[]>([]);
  readonly bookResults = signal<ContentItem[]>([]);
  readonly isLoadingMovies = signal(false);
  readonly isLoadingSeries = signal(false);
  readonly isLoadingBooks = signal(false);

  readonly trendingResults = signal<ContentItem[]>([]);
  readonly isLoadingTrending = signal(false);

  // contentId-ovi cija slika nije uspela da se ucita (vidi (error) na <img>).
  private readonly brokenImageIds = signal<Set<string>>(new Set());

  readonly visibleMovies = computed(() =>
    this.movieResults().filter((r) => !this.brokenImageIds().has(r.contentId))
  );
  readonly visibleSeries = computed(() =>
    this.seriesResults().filter((r) => !this.brokenImageIds().has(r.contentId))
  );
  readonly visibleBooks = computed(() =>
    this.bookResults().filter((r) => !this.brokenImageIds().has(r.contentId))
  );
  readonly visibleTrending = computed(() =>
    this.trendingResults().filter((r) => !this.brokenImageIds().has(r.contentId))
  );

  readonly counts = computed(() => ({
    all: this.visibleMovies().length + this.visibleSeries().length + this.visibleBooks().length,
    movie: this.visibleMovies().length,
    series: this.visibleSeries().length,
    book: this.visibleBooks().length
  }));

  readonly isAnyLoading = computed(() => this.isLoadingMovies() || this.isLoadingSeries() || this.isLoadingBooks());

  readonly categoryResults = computed<ContentItem[]>(() => {
    switch (this.category()) {
      case 'movie':
        return this.visibleMovies();
      case 'series':
        return this.visibleSeries();
      case 'book':
        return this.visibleBooks();
      default:
        return [];
    }
  });

  readonly isCategoryLoading = computed(() => {
    switch (this.category()) {
      case 'movie':
        return this.isLoadingMovies();
      case 'series':
        return this.isLoadingSeries();
      case 'book':
        return this.isLoadingBooks();
      default:
        return false;
    }
  });

  // Referencama na scroll kontejnere svakog reda upravljaju strelice levo/desno.
  readonly moviesScroll = viewChild<ElementRef<HTMLElement>>('moviesScrollEl');
  readonly seriesScroll = viewChild<ElementRef<HTMLElement>>('seriesScrollEl');
  readonly booksScroll = viewChild<ElementRef<HTMLElement>>('booksScrollEl');

  constructor() {
    // Jedan deljen debounced stream - sve tri pretrage se granaju odavde preko switchMap.
    const debouncedQuery$ = this.queryControl.valueChanges.pipe(
      map((value) => value.trim()),
      debounceTime(400),
      distinctUntilChanged(),
      share()
    );

    debouncedQuery$.subscribe((query) => {
      this.brokenImageIds.set(new Set());

      if (!query) {
        this.hasSearched.set(false);
        this.movieResults.set([]);
        this.seriesResults.set([]);
        this.bookResults.set([]);
        return;
      }

      this.hasSearched.set(true);
      this.category.set('all');
    });

    this.bindSearch(debouncedQuery$, (q) => this.contentService.searchMovies(q), this.movieResults, this.isLoadingMovies);
    this.bindSearch(debouncedQuery$, (q) => this.contentService.searchSeries(q), this.seriesResults, this.isLoadingSeries);
    this.bindSearch(debouncedQuery$, (q) => this.contentService.searchBooks(q), this.bookResults, this.isLoadingBooks);

    // Ponovo izracunaj sirinu kartica kad se sadrzaj/vidljivost reda promeni.
    effect(() => {
      this.visibleMovies();
      this.visibleSeries();
      this.visibleBooks();
      this.isLoadingMovies();
      this.isLoadingSeries();
      this.isLoadingBooks();
      this.category();
      this.moviesScroll();
      this.seriesScroll();
      this.booksScroll();

      requestAnimationFrame(() => this.fitAllRows());
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    requestAnimationFrame(() => this.fitAllRows());
  }

  // Racuna sirinu kartice tako da tacno TARGET_VISIBLE_COUNT ispuni red bez ostatka.
  private fitAllRows(): void {
    const referenceEl = this.moviesScroll()?.nativeElement ?? this.seriesScroll()?.nativeElement ?? this.booksScroll()?.nativeElement;

    if (!referenceEl) {
      return;
    }

    const available = referenceEl.clientWidth;

    if (available <= 0) {
      return;
    }

    const rawItemWidth = (available - (TARGET_VISIBLE_COUNT - 1) * ROW_ITEM_GAP) / TARGET_VISIBLE_COUNT;
    const itemWidth = Math.min(MAX_ITEM_WIDTH, Math.max(MIN_ITEM_WIDTH, rawItemWidth));

    this.currentItemWidth = itemWidth;
    this.hostElement.style.setProperty('--row-item-width', `${itemWidth}px`);
  }

  ngOnInit(): void {
    this.isLoadingTrending.set(true);

    this.contentService.getTrending().subscribe({
      next: (response) => {
        this.trendingResults.set(response.results);
        this.isLoadingTrending.set(false);
      },
      error: () => this.isLoadingTrending.set(false)
    });
  }

  setCategory(category: Category): void {
    this.category.set(category);
  }

  itemTypeLabel(type: ContentType): string {
    return ITEM_TYPE_LABELS[type];
  }

  markImageBroken(contentId: string): void {
    const next = new Set(this.brokenImageIds());
    next.add(contentId);
    this.brokenImageIds.set(next);
  }

  scrollRow(rowRef: ElementRef<HTMLElement> | undefined, direction: 1 | -1): void {
    const amount = 2 * (this.currentItemWidth + ROW_ITEM_GAP);
    rowRef?.nativeElement.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  // switchMap otkazuje prethodni zahtev kad stigne novi upit - sprecava da spor/zakasneo odgovor prepise novije rezultate.
  private bindSearch(
    query$: Observable<string>,
    search: (query: string) => Observable<SearchResponse>,
    resultsSignal: ReturnType<typeof signal<ContentItem[]>>,
    loadingSignal: ReturnType<typeof signal<boolean>>
  ): void {
    query$
      .pipe(
        switchMap((query) => {
          if (!query) {
            loadingSignal.set(false);
            return of(EMPTY_RESPONSE);
          }

          loadingSignal.set(true);

          return search(query).pipe(catchError(() => of(EMPTY_RESPONSE)));
        })
      )
      .subscribe((response) => {
        resultsSignal.set(response.results);
        loadingSignal.set(false);
      });
  }
}
