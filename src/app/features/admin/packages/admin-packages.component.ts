import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface SiteOpt {
  id: string;
  name: string;
}

interface PackageRow {
  id: string;
  name: string;
  site: string;
  site_name: string;
  price_tzs: string;
  duration_minutes: number;
  data_limit_mb: number | null;
  speed_profile: string;
  mikrotik_profile_name: string;
  mikrotik_limit_uptime: string;
  is_active: boolean;
  sort_order: number;
}

@Component({
  selector: 'app-admin-packages',
  standalone: true,
  imports: [FormsModule, ErrorStateComponent, SkeletonComponent, DecimalPipe],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Packages</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          CRUD / activate — soft-disable badala ya kufuta
        </p>
      </div>

      <form
        class="grid gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-3"
        (ngSubmit)="create()"
      >
        <label class="block text-sm sm:col-span-2 lg:col-span-1">
          <span class="text-[var(--text-secondary)]">Site</span>
          <select
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="form.site"
            name="site"
            required
          >
            <option value="" disabled>Chagua site</option>
            @for (s of sites(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Jina</span>
          <input
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="form.name"
            name="name"
            required
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Bei (TZS)</span>
          <input
            type="number"
            min="1"
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="form.price_tzs"
            name="price"
            required
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Muda (dakika)</span>
          <input
            type="number"
            min="1"
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="form.duration_minutes"
            name="duration"
            required
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">MikroTik profile</span>
          <input
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="form.mikrotik_profile_name"
            name="profile"
            placeholder="default"
          />
        </label>
        <div class="flex items-end">
          <button
            type="submit"
            class="w-full rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            [disabled]="saving()"
          >
            {{ saving() ? 'Inahifadhi…' : 'Ongeza package' }}
          </button>
        </div>
      </form>

      @if (formError()) {
        <app-error-state title="Hitilafu" [message]="formError()!" />
      }

      @if (loading()) {
        <app-skeleton height="8rem" />
      } @else if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      } @else {
        <div class="overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-soft">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border text-[var(--text-secondary)]">
              <tr>
                <th class="px-4 py-3 font-semibold">Package</th>
                <th class="px-4 py-3 font-semibold">Site</th>
                <th class="px-4 py-3 font-semibold">Bei</th>
                <th class="px-4 py-3 font-semibold">Muda</th>
                <th class="px-4 py-3 font-semibold">Hali</th>
                <th class="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              @for (pkg of packages(); track pkg.id) {
                <tr class="border-b border-border/70">
                  <td class="px-4 py-3 font-semibold text-ink">{{ pkg.name }}</td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">{{ pkg.site_name }}</td>
                  <td class="px-4 py-3 text-signal">
                    TZS {{ pkg.price_tzs | number: '1.0-0' }}
                  </td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">
                    {{ pkg.duration_minutes }} dk
                  </td>
                  <td class="px-4 py-3">
                    <span [class]="pkg.is_active ? 'text-success' : 'text-danger'">
                      {{ pkg.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal-muted disabled:opacity-50"
                      [disabled]="togglingId() === pkg.id"
                      (click)="toggle(pkg)"
                    >
                      {{ pkg.is_active ? 'Zima' : 'Washa' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminPackagesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly packages = signal<PackageRow[]>([]);
  readonly sites = signal<SiteOpt[]>([]);
  readonly togglingId = signal<string | null>(null);

  form = {
    site: '',
    name: '',
    price_tzs: 1000,
    duration_minutes: 60,
    mikrotik_profile_name: 'default',
  };

  ngOnInit(): void {
    this.api.get<SiteOpt[]>('/admin/sites/').subscribe({
      next: (data) => this.sites.set(Array.isArray(data) ? data : []),
    });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.get<PackageRow[]>('/admin/packages/', { page_size: 100 }).subscribe({
      next: (data) => {
        this.packages.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }

  create(): void {
    this.formError.set(null);
    if (!this.form.site || !this.form.name) {
      this.formError.set('Site na jina zinahitajika.');
      return;
    }
    this.saving.set(true);
    this.api
      .post<PackageRow>('/admin/packages/', {
        site: this.form.site,
        name: this.form.name,
        price_tzs: this.form.price_tzs,
        duration_minutes: this.form.duration_minutes,
        mikrotik_profile_name: this.form.mikrotik_profile_name || 'default',
        is_active: true,
        sort_order: 0,
      })
      .subscribe({
        next: () => {
          this.form.name = '';
          this.saving.set(false);
          this.reload();
        },
        error: (err: unknown) => {
          this.formError.set(err instanceof AppError ? err.message : 'Imeshindikana.');
          this.saving.set(false);
        },
      });
  }

  toggle(pkg: PackageRow): void {
    this.togglingId.set(pkg.id);
    const next = !pkg.is_active;
    const req = next
      ? this.api.patch<PackageRow>(`/admin/packages/${pkg.id}/`, { is_active: true })
      : this.api.delete<{ id: string; is_active: boolean }>(`/admin/packages/${pkg.id}/`);

    req.subscribe({
      next: () => {
        this.packages.update((list) =>
          list.map((p) => (p.id === pkg.id ? { ...p, is_active: next } : p)),
        );
        this.togglingId.set(null);
      },
      error: (err: unknown) => {
        this.formError.set(err instanceof AppError ? err.message : 'Imeshindikana.');
        this.togglingId.set(null);
      },
    });
  }
}
