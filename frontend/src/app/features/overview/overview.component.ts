import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ContentService } from '../../core/services/content.service';
import { TrackingService } from '../../core/services/tracking.service';
import { ContentItem } from '../../core/models/content.models';
import { TrackingStats } from '../../core/models/tracking.models';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

@Component({
  selector: 'app-overview',
  imports: [TopNavComponent, RouterLink, DecimalPipe],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
})
export class OverviewComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly trackingService = inject(TrackingService);
  private readonly contentService = inject(ContentService);

  readonly stats = signal<TrackingStats | null>(null);
  readonly trendingMovie = signal<ContentItem | null>(null);
  readonly trendingSeries = signal<ContentItem | null>(null);
  readonly trendingBook = signal<ContentItem | null>(null);

  ngOnInit(): void {
    this.trackingService.getStats().subscribe({ next: s => this.stats.set(s), error: () => {} });

    this.contentService.getTrendingMovies().subscribe({
      next: r => this.trendingMovie.set(r.results[0] ?? null),
      error: () => {},
    });
    this.contentService.getTrendingSeries().subscribe({
      next: r => this.trendingSeries.set(r.results[0] ?? null),
      error: () => {},
    });
    this.contentService.getTrendingBooks().subscribe({
      next: r => this.trendingBook.set(r.results[0] ?? null),
      error: () => {},
    });
  }

  detailRoute(item: ContentItem): string[] {
    return ['/title', item.contentType, item.contentId];
  }
}
