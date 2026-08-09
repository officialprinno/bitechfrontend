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

interface NodeOpt {
  id: string;
  node_identifier: string;
  site: string;
}

interface PackageOpt {
  id: string;
  name: string;
  site: string;
}

interface BreakdownRow {
  id: string | null;
  name: string;
  site_name?: string;
  count: number;
  revenue: string;
}

interface SalesReport {
  summary: {
    payment_count: number;
    voucher_count: number;
    total_revenue: string;
    currency: string;
    average_daily_revenue: string;
  };
  by_site: BreakdownRow[];
  by_node: BreakdownRow[];
  by_package: BreakdownRow[];
  by_day: { day: string | null; count: number; revenue: string }[];
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Mauzo</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Ripoti ya malipo yaliyofanikiwa (site / node / package / kipindi)
        </p>
      </div>

      <form
        class="grid gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-3"
        (ngSubmit)="load()"
      >
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Site</span>
          <select
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="siteId"
            name="siteId"
            (ngModelChange)="onSiteChange()"
          >
            <option value="">Zote</option>
            @for (s of sites(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Node</span>
          <select
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="nodeId"
            name="nodeId"
          >
            <option value="">Zote</option>
            @for (n of filteredNodes(); track n.id) {
              <option [value]="n.id">{{ n.node_identifier }}</option>
            }
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Package</span>
          <select
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="packageId"
            name="packageId"
          >
            <option value="">Zote</option>
            @for (p of filteredPackages(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Kutoka</span>
          <input
            type="date"
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="dateFrom"
            name="dateFrom"
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Hadi</span>
          <input
            type="date"
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="dateTo"
            name="dateTo"
          />
        </label>
        <div class="flex items-end">
          <button
            type="submit"
            class="w-full rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            [disabled]="loading()"
          >
            {{ loading() ? 'Inapakia…' : 'Onyesha' }}
          </button>
        </div>
      </form>

      @if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      }

      @if (loading()) {
        <app-skeleton height="8rem" />
      } @else if (report(); as r) {
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Vouchers</p>
            <p class="mt-2 font-display text-3xl font-bold text-ink">
              {{ r.summary.voucher_count }}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Mapato</p>
            <p class="mt-2 font-display text-2xl font-bold text-signal">
              TZS {{ r.summary.total_revenue | number: '1.0-0' }}
            </p>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Wastani / siku
            </p>
            <p class="mt-2 font-display text-2xl font-bold text-ink">
              TZS {{ r.summary.average_daily_revenue | number: '1.0-0' }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <h2 class="font-display text-base font-semibold text-ink">Kwa site</h2>
            <ul class="mt-3 divide-y divide-border text-sm">
              @for (row of r.by_site; track row.id) {
                <li class="flex justify-between py-2">
                  <span class="text-ink">{{ row.name }}</span>
                  <span class="text-[var(--text-secondary)]">
                    {{ row.count }} · TZS {{ row.revenue | number: '1.0-0' }}
                  </span>
                </li>
              } @empty {
                <li class="py-4 text-[var(--text-secondary)]">Hakuna data.</li>
              }
            </ul>
          </div>
          <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
            <h2 class="font-display text-base font-semibold text-ink">Kwa package</h2>
            <ul class="mt-3 divide-y divide-border text-sm">
              @for (row of r.by_package; track row.id) {
                <li class="flex justify-between py-2">
                  <span class="text-ink">{{ row.name }}</span>
                  <span class="text-[var(--text-secondary)]">
                    {{ row.count }} · TZS {{ row.revenue | number: '1.0-0' }}
                  </span>
                </li>
              } @empty {
                <li class="py-4 text-[var(--text-secondary)]">Hakuna data.</li>
              }
            </ul>
          </div>
        </div>

        <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
          <h2 class="font-display text-base font-semibold text-ink">Kwa node</h2>
          <ul class="mt-3 divide-y divide-border text-sm">
            @for (row of r.by_node; track row.id) {
              <li class="flex justify-between py-2">
                <span>
                  <span class="font-semibold text-ink">{{ row.name }}</span>
                  <span class="ml-2 text-[var(--text-secondary)]">{{ row.site_name }}</span>
                </span>
                <span class="text-[var(--text-secondary)]">
                  {{ row.count }} · TZS {{ row.revenue | number: '1.0-0' }}
                </span>
              </li>
            } @empty {
              <li class="py-4 text-[var(--text-secondary)]">Hakuna data.</li>
            }
          </ul>
        </div>
      }
    </section>
  `,
})
export class AdminReportsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  siteId = '';
  nodeId = '';
  packageId = '';
  dateFrom = '';
  dateTo = '';

  readonly sites = signal<SiteOpt[]>([]);
  readonly nodes = signal<NodeOpt[]>([]);
  readonly packages = signal<PackageOpt[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly report = signal<SalesReport | null>(null);

  ngOnInit(): void {
    this.api.get<SiteOpt[]>('/admin/sites/').subscribe({
      next: (data) => this.sites.set(Array.isArray(data) ? data : []),
    });
    this.api.get<NodeOpt[]>('/admin/nodes/', { page_size: 100 }).subscribe({
      next: (data) => this.nodes.set(Array.isArray(data) ? data : []),
    });
    this.api.get<PackageOpt[]>('/admin/packages/', { page_size: 100 }).subscribe({
      next: (data) => this.packages.set(Array.isArray(data) ? data : []),
    });
    this.load();
  }

  filteredNodes(): NodeOpt[] {
    const all = this.nodes();
    if (!this.siteId) {
      return all;
    }
    return all.filter((n) => n.site === this.siteId);
  }

  filteredPackages(): PackageOpt[] {
    const all = this.packages();
    if (!this.siteId) {
      return all;
    }
    return all.filter((p) => p.site === this.siteId);
  }

  onSiteChange(): void {
    this.nodeId = '';
    this.packageId = '';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<SalesReport>('/admin/reports/sales/', {
        site: this.siteId || undefined,
        node: this.nodeId || undefined,
        package: this.packageId || undefined,
        date_from: this.dateFrom || undefined,
        date_to: this.dateTo || undefined,
      })
      .subscribe({
        next: (data) => {
          this.report.set(data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
          this.loading.set(false);
        },
      });
  }
}
