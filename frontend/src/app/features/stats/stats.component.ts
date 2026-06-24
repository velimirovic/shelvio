import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TrackingService } from '../../core/services/tracking.service';
import { GenreCount, TrackingStats } from '../../core/models/tracking.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

// Prosecna brzina hoda - koristi se SAMO za "fun fact" konverziju (hoursWatched ->
// kilometri), nije stvarno mereno. Jasno obelezeno kao igra brojeva na UI-ju.
const WALKING_SPEED_KMH = 5;

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

// r=50 + stroke-width 14 (vidi .scss) = ivica na 57, dok je viewBox 120x120 (centar
// 60,60) - ranije je r bio 54 sto je davalo ivicu na 61, PRESLO viewBox i secalo krug.
const DONUT_RADIUS = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

// Cisto SVG stroke-dasharray donut (bez chart biblioteke) - svaki segment je krug
// iste velicine sa drugim dashArray/dashOffset, rotiran -90deg da pocinje od vrha.
function buildDonut(items: { label: string; value: number; color: string }[]): DonutSegment[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return [];
  }

  let offsetAcc = 0;

  return items
    .filter((item) => item.value > 0)
    .map((item) => {
      const length = (item.value / total) * DONUT_CIRCUMFERENCE;
      const segment: DonutSegment = {
        label: item.label,
        value: item.value,
        color: item.color,
        dashArray: `${length} ${DONUT_CIRCUMFERENCE - length}`,
        dashOffset: -offsetAcc
      };
      offsetAcc += length;
      return segment;
    });
}

@Component({
  selector: 'app-stats',
  imports: [TopNavComponent, DecimalPipe],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  private readonly trackingService = inject(TrackingService);

  readonly stats = signal<TrackingStats | null>(null);
  readonly isLoading = signal(true);

  readonly donutRadius = DONUT_RADIUS;
  readonly donutCircumference = DONUT_CIRCUMFERENCE;

  readonly typeDonut = computed(() => {
    const s = this.stats();
    if (!s) return [];

    return buildDonut([
      { label: 'movies', value: s.movieCount, color: 'var(--accent)' },
      { label: 'series', value: s.seriesCount, color: '#8b95ea' },
      { label: 'books', value: s.bookCount, color: '#c2c8f4' }
    ]);
  });

  readonly statusDonut = computed(() => {
    const s = this.stats();
    if (!s) return [];

    return buildDonut([
      { label: 'done', value: s.doneCount, color: '#4e8c5c' },
      { label: 'in progress', value: s.inProgressCount, color: 'var(--accent)' },
      { label: 'plan', value: s.planCount, color: '#a9772a' }
    ]);
  });

  // "Kilometers you'd have walked" - fun-fact konverzija iz hoursWatched, ne stvarno
  // mereno (jasno naznaceno na UI-ju). 5 km/h je standardna prosecna brzina hoda.
  readonly kmWalked = computed(() => (this.stats()?.hoursWatched ?? 0) * WALKING_SPEED_KMH);

  ngOnInit(): void {
    this.trackingService.getStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  // Svaka zanr-lista se skalira na SOPSTVENI maksimum (ne na zajednicki) - inace bi
  // tip sa manje stavki (npr. knjige) uvek izgledao "tanje" iako je proporcija unutar
  // njega ista.
  genreBarWidth(genres: GenreCount[], count: number): number {
    const max = Math.max(1, ...genres.map((g) => g.count));
    return Math.round((count / max) * 100);
  }
}
