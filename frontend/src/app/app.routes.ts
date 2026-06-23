import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent)
  },
  {
    path: 'overview',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/overview/overview.component').then((m) => m.OverviewComponent)
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent)
  },
  { path: '**', redirectTo: 'overview' }
];
