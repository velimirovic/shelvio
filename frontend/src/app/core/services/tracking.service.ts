import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContentType } from '../models/content.models';
import { CreateTrackingEntry, FavoritePick, TrackingEntry, TrackingStats, UpdateTrackingEntry } from '../models/tracking.models';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);

  // Backend radi upsert - isti pozив kreira ili azurira, frontend ne mora da razlikuje.
  addOrUpdate(entry: CreateTrackingEntry): Observable<TrackingEntry> {
    return this.http.post<TrackingEntry>(`${environment.apiUrl}/tracking`, entry);
  }

  update(id: string, dto: UpdateTrackingEntry): Observable<TrackingEntry> {
    return this.http.put<TrackingEntry>(`${environment.apiUrl}/tracking/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/tracking/${id}`);
  }

  getAll(status?: string): Observable<TrackingEntry[]> {
    return this.http.get<TrackingEntry[]>(`${environment.apiUrl}/tracking`, {
      params: status ? { status } : {}
    });
  }

  getByContent(type: ContentType, id: string): Observable<TrackingEntry | null> {
    return this.http.get<TrackingEntry>(`${environment.apiUrl}/tracking/${type}/${id}`);
  }

  getStats(): Observable<TrackingStats> {
    return this.http.get<TrackingStats>(`${environment.apiUrl}/tracking/stats`);
  }

  getFavoritePicks(): Observable<FavoritePick[]> {
    return this.http.get<FavoritePick[]>(`${environment.apiUrl}/tracking/favorites`);
  }

  setFavoritePick(contentType: ContentType, position: number, trackingEntryId: string): Observable<FavoritePick> {
    return this.http.put<FavoritePick>(`${environment.apiUrl}/tracking/favorites/${contentType}/${position}`, {
      trackingEntryId
    });
  }

  clearFavoritePick(contentType: ContentType, position: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/tracking/favorites/${contentType}/${position}`);
  }
}
