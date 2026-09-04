import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface AgentDashboard {
  assignments: { active: number };
  batches: { count: number; issued_inventory: number };
  vouchers: Record<string, number>;
  issuance: Record<string, number>;
  debt: { unpaid_total: string; unpaid_batches: number; unpaid_vouchers: number };
  recent_activity: { at: string; type: string; label: string }[];
}

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between gap-3">
        <div><h1 class="font-display text-2xl font-bold">Dashboard</h1><p class="text-sm text-[var(--text-secondary)]">Your inventory and assignments</p></div>
        <a routerLink="/agent/inventory" class="font-semibold text-signal no-underline">View vouchers →</a>
      </div>
      @if (loading()) { <app-skeleton height="10rem" /> }
      @else if (error()) { <app-error-state title="Hitilafu" [message]="error()!" /> }
      @else if (dashboard(); as d) {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a class="card" routerLink="/agent/inventory"><span>Active sites</span><strong>{{ d.assignments.active }}</strong></a>
          <a class="card" routerLink="/agent/inventory"><span>Issued inventory</span><strong>{{ d.batches.issued_inventory }}</strong></a>
          <a class="card" routerLink="/agent/inventory"><span>Ready vouchers</span><strong class="text-success">{{ d.vouchers['ready'] }}</strong></a>
          <a class="card" routerLink="/agent/inventory"><span>Activated</span><strong>{{ d.vouchers['activated'] }}</strong></a>
          <a class="card" routerLink="/agent/inventory"><span>Pending / failed</span><strong>{{ d.vouchers['provisioning_pending'] }} / {{ d.vouchers['provisioning_failed'] }}</strong></a>
          <a class="card" routerLink="/agent/inventory"><span>Expired / revoked</span><strong>{{ d.vouchers['expired'] }} / {{ d.vouchers['revoked'] }}</strong></a>
        </div>
        <a routerLink="/agent/inventory" class="summary-link block rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <p class="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Current settlement</p>
          <p class="mt-2 text-2xl font-bold text-warning">TZS {{ d.debt.unpaid_total | number: '1.0-0' }}</p>
          <p class="text-sm text-[var(--text-secondary)]">{{ d.debt.unpaid_batches }} batches · {{ d.debt.unpaid_vouchers }} vouchers</p>
        </a>
        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <h2 class="font-display font-semibold">Recent activity</h2>
          <ul class="mt-3 divide-y divide-border">
            @for (event of d.recent_activity; track event.at + event.type) {
              <li class="flex justify-between gap-3 py-3 text-sm"><span>{{ event.type.replaceAll('_', ' ') }} · {{ event.label }}</span><time class="text-[var(--text-secondary)]">{{ event.at | date: 'short' }}</time></li>
            } @empty { <li class="py-4 text-sm text-[var(--text-secondary)]">No recent activity.</li> }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [`
    .card { position:relative; display:flex; min-height:6.25rem; flex-direction:column; gap:.5rem; border:1px solid var(--border-subtle); border-radius:1rem; background:var(--surface-1); padding:1rem 2.5rem 1rem 1rem; color:var(--text-primary); text-decoration:none; box-shadow:var(--shadow-soft); cursor:pointer; transition:transform var(--motion-fast) var(--motion-ease), border-color var(--motion-fast), box-shadow var(--motion-fast); }
    .card::after { position:absolute; right:1rem; top:50%; content:'→'; color:var(--brand-signal); font-size:1.1rem; transform:translateY(-50%); }
    .card:hover { transform:translateY(-2px); border-color:var(--brand-signal); box-shadow:0 10px 26px rgb(0 0 0 / 25%); }
    .card span { font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-secondary); }
    .card strong { color:var(--text-primary); font-family:var(--font-display); font-size:1.75rem; line-height:1.1; }
    .card strong.text-success { color:var(--success); }
    .summary-link { color:var(--text-primary); text-decoration:none; transition:border-color var(--motion-fast), transform var(--motion-fast) var(--motion-ease); }
    .summary-link:hover { transform:translateY(-1px); border-color:var(--brand-signal); }
  `],
})
export class AgentDashboardComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dashboard = signal<AgentDashboard | null>(null);

  ngOnInit(): void {
    this.api.get<AgentDashboard>('/agent/dashboard/', { range: '30d' }).subscribe({
      next: (data) => { this.dashboard.set(data); this.loading.set(false); },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }
}
