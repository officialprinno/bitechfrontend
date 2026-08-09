import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { AppError } from '../../core/models/app-error';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';

@Component({
  selector: 'app-agent-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ErrorStateComponent, RouterLink],
  template: `
    <div class="flex min-h-full items-center justify-center bg-surface-0 px-4 py-12" data-theme="dark">
      <div class="w-full max-w-md space-y-6">
        <div class="text-center">
          <img src="brand/logo-mark.svg" alt="" class="mx-auto h-12 w-12 rounded-2xl" />
          <h1 class="mt-4 font-display text-2xl font-bold text-ink">Agent Portal</h1>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            Angalia vouchers zilizotolewa na admin
          </p>
        </div>

        <form
          class="space-y-4 rounded-2xl border border-border bg-surface-1 p-6 shadow-soft"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <label class="block space-y-1.5 text-sm">
            <span class="font-semibold text-ink">Username</span>
            <input
              formControlName="username"
              autocomplete="username"
              class="w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            />
          </label>
          <label class="block space-y-1.5 text-sm">
            <span class="font-semibold text-ink">Nenosiri</span>
            <input
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            />
          </label>

          @if (error()) {
            <app-error-state title="Imeshindikana" [message]="error()!" />
          }

          <app-button type="submit" [loading]="loading()" [disabled]="form.invalid">
            Ingia
          </app-button>
        </form>

        <p class="text-center text-xs text-[var(--text-secondary)]">
          Admin?
          <a routerLink="/admin/login" class="font-semibold text-signal no-underline">Admin login</a>
        </p>
      </div>
    </div>
  `,
})
export class AgentLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

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
    this.auth.agentLogin(username, password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/agent');
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(err instanceof AppError ? err.message : 'Login imeshindikana.');
      },
    });
  }
}
