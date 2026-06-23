import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Deljeno stanje izmedju svih zahteva (van funkcije, jer je interceptor pozivan za
// SVAKI HTTP zahtev) - sprecava da vise paralelnih 401 odgovora pokrene vise
// istovremenih /refresh poziva.
let isRefreshing = false;
const refreshedAccessToken$ = new BehaviorSubject<string | null>(null);

function withAuthHeader<T>(req: HttpRequest<T>, accessToken: string | null): HttpRequest<T> {
  if (!accessToken) {
    return req;
  }

  return req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/refresh'].some((path) =>
    req.url.includes(path)
  );

  return next(withAuthHeader(req, authService.getAccessToken())).pipe(
    catchError((error: HttpErrorResponse) => {
      // Pogresna lozinka, /refresh koji je sam pao, itd. - ne pokusavaj refresh, samo prosledi gresku.
      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Refresh je vec u toku (pokrenut drugim zahtevom) - sacekaj njegov rezultat
        // pa ponovi ovaj zahtev sa novim tokenom.
        return refreshedAccessToken$.pipe(
          filter((token) => token !== null),
          take(1),
          switchMap((token) => next(withAuthHeader(req, token)))
        );
      }

      isRefreshing = true;
      refreshedAccessToken$.next(null);

      return authService.refreshToken().pipe(
        switchMap((response) => {
          isRefreshing = false;
          refreshedAccessToken$.next(response.accessToken);
          return next(withAuthHeader(req, response.accessToken));
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authService.clearSession();
          router.navigate(['/auth']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
