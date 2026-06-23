import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-overview',
  imports: [],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent implements OnInit {
  constructor(
    readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Ucitaj svez profil sa zasticenog endpoint-a - ako je access token istekao,
    // auth interceptor ga sam obnavlja u pozadini i ponavlja ovaj poziv.
    this.authService.getMe().subscribe();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth']),
      error: () => this.router.navigate(['/auth'])
    });
  }
}
