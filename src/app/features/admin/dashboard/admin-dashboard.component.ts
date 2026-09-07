import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface Dashboard {
  role: 'superadmin' | 'site_manager' | 'support';
  range: { key: string; from: string; to: string };
  scope: { site_count: number };
  resources: Record<string, number>;
  assignments: { active: number; suspended: number; ended_in_range: number };
  vouchers: Record<string, number>;
  issuance: Record<string, number>;
  operations: Record<string, number>;
  customer_payments?: {
    currency: string;
    count: number;
    amount: string;
    by_gateway: Record<string, { count: number; amount: string }>;
  };
  recent_activity: { at: string; type: string; label: string }[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [ErrorStateComponent, SkeletonComponent, DecimalPipe, DatePipe, RouterLink],
  template: `
    <section class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-2xl font-bold text-ink">Dashboard</h1>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            {{ auth.user()?.username }} · server-scoped operations
          </p>
        </div>
        <div class="flex gap-2" aria-label="Dashboard time range">
          @for (option of ranges; track option.key) {
            <a routerLink="/admin" [queryParams]="{ range: option.key }"
              class="rounded-lg border px-3 py-2 text-sm"
              [class.border-signal]="selectedRange() === option.key">
              {{ option.label }}
            </a>
          }
        </div>
      </div>

      @if (loading()) {
        <app-skeleton height="10rem" />
      } @else if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      } @else if (dashboard(); as d) {
        <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
          {{ d.role }} · {{ d.scope.site_count }} site(s)
        </p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <a class="card" routerLink="/admin/agents" [queryParams]="{status:'active',assigned:'active'}"><span>Active agents</span><strong>{{ d.resources['active_agents'] }}</strong></a>
          <a class="card" routerLink="/admin/agent-assignments" [queryParams]="{status:'active',scope:'current'}"><span>Active assignments</span><strong>{{ d.assignments.active }}</strong></a>
          <a class="card" routerLink="/admin/nodes" [queryParams]="{status:'offline',active:'true'}"><span>Nodes offline</span><strong class="text-danger">{{ d.resources['offline_nodes'] }}</strong></a>
          <a class="card" routerLink="/admin/operations" [queryParams]="{tab:'provisioning',status:'pending',range:selectedRange()}"><span>Provisioning pending</span><strong>{{ d.vouchers['provisioning_pending'] }}</strong></a>
          <a class="card" routerLink="/admin/support" [queryParams]="{source:null,lifecycle:'ready',range:selectedRange()}"><span>Vouchers ready</span><strong class="text-success">{{ d.vouchers['ready'] }}</strong></a>
          <a class="card" routerLink="/admin/support" [queryParams]="{source:null,lifecycle:'activated',range:selectedRange()}"><span>Activated</span><strong>{{ d.vouchers['activated'] }}</strong></a>
          <a class="card" routerLink="/admin/support" [queryParams]="{source:null,lifecycle:'expired',range:selectedRange()}"><span>Expired</span><strong>{{ d.vouchers['expired'] }}</strong></a>
          <a class="card" routerLink="/admin/support" [queryParams]="{source:null,lifecycle:'revoked',range:selectedRange()}"><span>Revoked</span><strong>{{ d.vouchers['revoked'] }}</strong></a>
          <a class="card" routerLink="/admin/operations" [queryParams]="{tab:'provisioning',status:'failed',range:selectedRange()}"><span>Provisioning failed</span><strong class="text-danger">{{ d.vouchers['provisioning_failed'] }}</strong></a>
          <a class="card" routerLink="/admin/agent-issuances" [queryParams]="{range:selectedRange()}"><span>Issuance requests</span><strong>{{ d.issuance['requests'] }}</strong></a>
          <a class="card" routerLink="/admin/agent-issuances" [queryParams]="{range:selectedRange()}"><span>Requested inventory</span><strong>{{ d.issuance['requested_quantity'] }}</strong></a>
          <a class="card" routerLink="/admin/agent-assignments" [queryParams]="{status:'suspended',scope:'current'}"><span>Suspended assignments</span><strong>{{ d.assignments.suspended }}</strong></a>
          <a class="card" routerLink="/admin/operations" [queryParams]="{tab:'router-enforcement',status:'open'}"><span>Router jobs open</span><strong>{{ d.operations['expiry_enforcement_open'] + d.operations['revocation_enforcement_open'] }}</strong></a>
        </div>

        @if (d.customer_payments; as payments) {
          <a routerLink="/admin/operations" [queryParams]="{tab:'payments',source:'customer',status:'success',succeeded_from:d.range.from,succeeded_to:d.range.to}" class="summary-link block rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
            <h2 class="font-display font-semibold">Customer payments only</h2>
            <p class="mt-2 text-2xl font-bold text-signal">TZS {{ payments.amount | number: '1.0-0' }}</p>
            <p class="text-sm text-[var(--text-secondary)]">
              {{ payments.count }} payments · AzamPay {{ payments.by_gateway['azampay'].count }} · Pesapal {{ payments.by_gateway['pesapal'].count }}
            </p>
          </a>
        }

        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <h2 class="font-display font-semibold">Recent activity</h2>
          <ul class="mt-3 divide-y divide-border">
            @for (event of d.recent_activity; track event.at + event.type) {
              <li class="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{{ event.type.replaceAll('_', ' ') }} · {{ event.label }}</span>
                <time class="text-[var(--text-secondary)]">{{ event.at | date: 'medium' }}</time>
              </li>
            } @empty { <li class="py-4 text-sm text-[var(--text-secondary)]">No activity in this range.</li> }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [`
    .card { position:relative; display:flex; min-height:6.25rem; flex-direction:column; gap:.5rem; border:1px solid var(--border-subtle); border-radius:1rem; background:var(--surface-1); padding:1rem 2.5rem 1rem 1rem; color:var(--text-primary); text-decoration:none; box-shadow:var(--shadow-soft); cursor:pointer; transition:transform var(--motion-fast) var(--motion-ease), border-color var(--motion-fast), box-shadow var(--motion-fast); }
    .card::after { position:absolute; right:1rem; top:50%; content:'→'; color:var(--brand-signal); font-size:1.1rem; transform:translateY(-50%); }
    .card:hover { transform:translateY(-2px); border-color:var(--brand-signal); box-shadow:0 10px 26px rgb(11 31 42 / 16%); }
    .card:focus-visible, .summary-link:focus-visible { outline:3px solid var(--brand-signal); outline-offset:3px; }
    .card span { font-size:.875rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary); }
    .card strong { color:var(--text-primary); font-family:var(--font-display); font-size:1.75rem; line-height:1.1; }
    .card strong.text-danger { color:var(--danger); }
    .card strong.text-success { color:var(--success); }
    .summary-link { color:var(--text-primary); text-decoration:none; transition:border-color var(--motion-fast), transform var(--motion-fast) var(--motion-ease); }
    .summary-link:hover { transform:translateY(-1px); border-color:var(--brand-signal); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly selectedRange = signal('7d');
  readonly ranges = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
  ];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const range = params.get('range') || '7d';
      this.load(this.ranges.some(x => x.key === range) ? range : '7d');
    });
  }

  load(range: string): void {
    this.selectedRange.set(range);
    this.loading.set(true);
    this.error.set(null);
    this.api.get<Dashboard>('/admin/dashboard/', { range }).subscribe({
      next: (data) => { this.dashboard.set(data); this.loading.set(false); },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }
}
