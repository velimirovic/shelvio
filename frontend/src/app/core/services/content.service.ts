import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContentDetails, ContentType, SearchResponse, SimilarResponse, TrendingResponse } from '../models/content.models';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);

  // Tri nezavisna poziva - ne kombinovati u forkJoin, filmovi/serije ne treba da cekaju spore knjige.
  searchMovies(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${environment.apiUrl}/content/search/movies`, {
      params: { query }
    });
  }

  searchSeries(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${environment.apiUrl}/content/search/series`, {
      params: { query }
    });
  }

  searchBooks(query: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${environment.apiUrl}/content/search/books`, {
      params: { query }
    });
  }

  getTrendingMovies(): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${environment.apiUrl}/content/trending/movies`);
  }

  getTrendingSeries(): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${environment.apiUrl}/content/trending/series`);
  }

  getTrendingBooks(): Observable<TrendingResponse> {
    return this.http.get<TrendingResponse>(`${environment.apiUrl}/content/trending/books`);
  }

  getDetails(type: ContentType, id: string): Observable<ContentDetails> {
    return this.http.get<ContentDetails>(`${environment.apiUrl}/content/${type}/${id}`);
  }

  // hint je relevantan samo za knjige (Hardcover nema "slicno", koristi se pretraga po autoru kao zamena).
  getSimilar(type: ContentType, id: string, hint?: string): Observable<SimilarResponse> {
    return this.http.get<SimilarResponse>(`${environment.apiUrl}/content/${type}/${id}/similar`, {
      params: hint ? { hint } : {}
    });
  }
}
