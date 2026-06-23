import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { TopNavComponent } from '../../shared/top-nav/top-nav.component';

@Component({
  selector: 'app-overview',
  imports: [TopNavComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent implements OnInit {
  readonly authService = inject(AuthService);

  ngOnInit(): void {
    // Ucitaj svez profil sa zasticenog endpoint-a - ako je access token istekao,
    // auth interceptor ga sam obnavlja u pozadini i ponavlja ovaj poziv.
    this.authService.getMe().subscribe();
  }
}
