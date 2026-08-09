import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { AppError } from '../../core/models/app-error';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ErrorStateComponent, RouterLink],
  template: `
    <div class="flex min-h-full items-center justify-center px-4 py-10" data-theme="dark">
      <div class="w-full max-w-md space-y-4">
        <div class="rounded-2xl border border-border bg-surface-1 p-6 shadow-soft sm:p-8">
          <div class="mb-8 flex items-center gap-3">
            <img src="brand/logo-mark.svg" alt="" class="h-10 w-10 rounded-xl" width="40" height="40" />
            <div>
              <h1 class="font-display text-xl font-bold text-ink">Bitech Admin</h1>
              <p class="text-sm text-[var(--text-secondary)]">Ingia kudhibiti sites na packages</p>
            </div>
          </div>

          <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit()">
            <label class="block space-y-1.5">
              <span class="text-sm font-semibold text-ink">Username</span>
              <input
                formControlName="username"
                autocomplete="username"
                class="w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-ink outline-none focus:border-signal"
              />
            </label>

            <label class="block space-y-1.5">
              <span class="text-sm font-semibold text-ink">Nenosiri</span>
              <input
                type="password"
                formControlName="password"
                autocomplete="current-password"
                class="w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-ink outline-none focus:border-signal"
              />
            </label>

            @if (error()) {
              <app-error-state title="Imeshindikana kuingia" [message]="error()!" />
            }

            <app-button type="submit" [loading]="loading()" [disabled]="form.invalid">
              Ingia
            </app-button>
          </form>
        </div>
        <p class="text-center text-xs text-[var(--text-secondary)]">
          Agent?
          <a routerLink="/agent/login" class="font-semibold text-signal no-underline">Agent login</a>
        </p>
      </div>
    </div>
  `,
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/admin');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu ya kuingia.');
      },
    });
  }
}
