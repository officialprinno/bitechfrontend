import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface SiteRow {
  id: string;
  name: string;
  region: string;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-sites',
  standalone: true,
  imports: [ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Sites</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">Usimamizi wa maeneo (M2 read list)</p>
      </div>

      @if (loading()) {
        <app-skeleton height="8rem" />
      } @else if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      } @else {
        <div class="overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-soft">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border text-[var(--text-secondary)]">
              <tr>
                <th class="px-4 py-3 font-semibold">Jina</th>
                <th class="px-4 py-3 font-semibold">Mkoa</th>
                <th class="px-4 py-3 font-semibold">Hali</th>
              </tr>
            </thead>
            <tbody>
              @for (site of sites(); track site.id) {
                <tr class="border-b border-border/70">
                  <td class="px-4 py-3 font-semibold text-ink">{{ site.name }}</td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">{{ site.region }}</td>
                  <td class="px-4 py-3">
                    <span [class]="site.is_active ? 'text-success' : 'text-danger'">
                      {{ site.is_active ? 'Active' : 'Inactive' }}
                    </span>
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
export class AdminSitesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sites = signal<SiteRow[]>([]);

  ngOnInit(): void {
    this.api.get<SiteRow[]>('/admin/sites/').subscribe({
      next: (data) => {
        this.sites.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }
}
