import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { AppError } from '../../core/models/app-error';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';

@Component({
  selector: 'app-unified-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ErrorStateComponent],
  template: `
    <main class="flex min-h-full items-center justify-center bg-surface-0 px-4 py-10" data-theme="dark">
      <section class="w-full max-w-md rounded-2xl border border-border bg-surface-1 p-6 shadow-soft sm:p-8" aria-labelledby="login-title">
        <header class="mb-8 flex items-center gap-3">
          <img src="brand/logo-mark.svg" alt="" class="h-11 w-11 rounded-xl" width="44" height="44" />
          <div>
            <h1 id="login-title" class="font-display text-xl font-bold text-ink">BitechWiFi</h1>
            <p class="text-sm text-[var(--text-secondary)]">Sign in to your workspace</p>
          </div>
        </header>

        <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <label class="block space-y-1.5">
            <span class="text-sm font-semibold text-ink">Username</span>
            <input formControlName="username" autocomplete="username" autofocus
              class="w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-ink outline-none focus:border-signal" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-sm font-semibold text-ink">Password</span>
            <div class="flex rounded-xl border border-border bg-surface-0 focus-within:border-signal">
              <input [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                autocomplete="current-password" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ink outline-none" />
              <button type="button" class="px-3 text-sm text-signal" (click)="togglePassword()"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </label>
          @if (error()) {
            <div aria-live="polite"><app-error-state title="Sign in failed" [message]="error()!" /></div>
          }
          <app-button type="submit" [loading]="loading()" [disabled]="form.invalid || loading()">Sign In</app-button>
        </form>
      </section>
    </main>
  `,
})
export class UnifiedLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const credentials = this.form.getRawValue();
    this.auth.login(credentials.username, credentials.password).subscribe({
      next: (response) => {
        this.loading.set(false);
        void this.router.navigateByUrl(response.redirect);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(err instanceof AppError ? err.message : 'Invalid credentials.');
      },
    });
  }
}
