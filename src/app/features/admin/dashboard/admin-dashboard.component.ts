import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface OverviewSite {
  id: string;
  name: string;
  slug: string;
  region: string;
  is_active: boolean;
  nodes: { online: number; offline: number; unknown: number };
  sales_24h: { count: number; revenue: string };
}

interface Overview {
  totals: {
    sites: number;
    online_nodes: number;
    offline_nodes: number;
    unknown_nodes: number;
    sales_24h_count: number;
    sales_24h_revenue: string;
  };
  sites: OverviewSite[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [ErrorStateComponent, SkeletonComponent, DecimalPipe, RouterLink],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Karibu, {{ auth.user()?.username }} · sites zote (M10)
        </p>
      </div>

      @if (loading()) {
        <app-skeleton height="8rem" />
      } @else if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      } @else if (overview(); as o) {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Sites</p>
            <p class="mt-2 font-display text-3xl font-bold text-ink">{{ o.totals.sites }}</p>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Nodes online</p>
            <p class="mt-2 font-display text-3xl font-bold text-success">
              {{ o.totals.online_nodes }}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Nodes offline</p>
            <p
              class="mt-2 font-display text-3xl font-bold"
              [class]="o.totals.offline_nodes ? 'text-danger' : 'text-ink'"
            >
              {{ o.totals.offline_nodes }}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Mauzo 24h</p>
            <p class="mt-2 font-display text-xl font-bold text-signal">
              TZS {{ o.totals.sales_24h_revenue | number: '1.0-0' }}
            </p>
            <p class="text-xs text-[var(--text-secondary)]">
              {{ o.totals.sales_24h_count }} malipo
            </p>
          </div>
        </div>

        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-display text-base font-semibold text-ink">Sites · health · mauzo</h2>
            <a
              routerLink="/admin/nodes"
              class="text-sm font-semibold text-signal no-underline hover:text-signal-hover"
            >
              Nodes →
            </a>
          </div>

          <ul class="mt-4 divide-y divide-border">
            @for (site of o.sites; track site.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p class="font-semibold text-ink">{{ site.name }}</p>
                  <p class="text-[var(--text-secondary)]">{{ site.region }} · {{ site.slug }}</p>
                </div>
                <div class="text-right">
                  <p>
                    <span class="text-success">{{ site.nodes.online }} online</span>
                    ·
                    <span [class]="site.nodes.offline ? 'text-danger' : 'text-[var(--text-secondary)]'">
                      {{ site.nodes.offline }} offline
                    </span>
                    @if (site.nodes.unknown) {
                      <span class="text-[var(--text-secondary)]">
                        · {{ site.nodes.unknown }} ?
                      </span>
                    }
                  </p>
                  <p class="text-xs text-[var(--text-secondary)]">
                    24h: {{ site.sales_24h.count }} · TZS
                    {{ site.sales_24h.revenue | number: '1.0-0' }}
                  </p>
                </div>
              </li>
            } @empty {
              <li class="py-6 text-sm text-[var(--text-secondary)]">
                Hakuna sites. Endesha <code>python manage.py seed_catalog</code>
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly overview = signal<Overview | null>(null);

  ngOnInit(): void {
    this.api.get<Overview>('/admin/overview/').subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }
}
