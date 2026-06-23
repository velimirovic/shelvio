import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isRegister = signal(false);
  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  setLogin(): void {
    this.isRegister.set(false);
    this.errorMessage.set(null);
  }

  setRegister(): void {
    this.isRegister.set(true);
    this.errorMessage.set(null);
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  submit(): void {
    this.errorMessage.set(null);

    const { username, email, password } = this.form.value;

    if (!username || !password || (this.isRegister() && !email)) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const request$ = this.isRegister()
      ? this.authService.register({ username, email: email!, password })
      : this.authService.login({ username, password });

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/overview']);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const body = err.error;

    if (typeof body?.error === 'string') {
      return body.error;
    }

    if (body?.errors) {
      const firstField = Object.keys(body.errors)[0];
      return body.errors[firstField]?.[0] ?? 'Something went wrong. Please try again.';
    }

    return 'Something went wrong. Please try again.';
  }
}
