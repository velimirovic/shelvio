import { ContentType } from './content.models';

export type TrackingStatusValue = 'plan' | 'in_progress' | 'done';

export interface TrackingEntry {
  id: string;
  contentId: string;
  contentType: ContentType;
  title: string;
  posterUrl: string | null;
  year: string | null;
  genres: string[];
  durationMinutes: number | null;
  pages: number | null;
  status: TrackingStatusValue;
  rating: number | null;
  addedAt: string;
}

export interface CreateTrackingEntry {
  contentId: string;
  contentType: ContentType;
  title: string;
  posterUrl: string | null;
  year: string | null;
  genres: string[];
  durationMinutes: number | null;
  pages: number | null;
  status: TrackingStatusValue;
  rating: number | null;
}

export interface UpdateTrackingEntry {
  status: TrackingStatusValue;
  rating: number | null;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface TrackingStats {
  totalTitles: number;
  planCount: number;
  inProgressCount: number;
  doneCount: number;
  movieCount: number;
  seriesCount: number;
  bookCount: number;
  hoursWatched: number;
  booksRead: number;
  pagesRead: number;
  averageRating: number | null;
  favoriteDecade: string | null;
  topMovieGenres: GenreCount[];
  topSeriesGenres: GenreCount[];
  topBookGenres: GenreCount[];
}

export interface FavoritePick {
  contentType: ContentType;
  position: number;
  entry: TrackingEntry;
}
