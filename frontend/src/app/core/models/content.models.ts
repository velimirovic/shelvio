export type ContentType = 'movie' | 'series' | 'book';

export interface ContentItem {
  contentId: string;
  contentType: ContentType;
  title: string;
  year: string | null;
  posterUrl: string | null;
  rating: number | null;
  overview: string;
}

export interface ContentDetails extends ContentItem {
  genres: string[];
}

export interface SearchResponse {
  query: string;
  count: number;
  results: ContentItem[];
}

export interface TrendingResponse {
  count: number;
  results: ContentItem[];
}
