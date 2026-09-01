import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface VoucherRow {
  id: string;
  username: string;
  password: string;
  phone_number: string;
  purchase_type: string;
  source: 'portal' | 'agent';
  agent_code: string;
  agent_name: string;
  package_name: string;
  site_name: string;
  node_identifier: string;
  status: string;
  is_used: boolean;
  mac_address: string;
  bound_device_name: string;
  is_online: boolean;
  usage_status: string;
  validity_started_at: string | null;
  session_started_at: string | null;
  session_last_seen_at: string | null;
  session_uptime: string;
  session_bps_in: number;
  session_bps_out: number;
  purchased_at: string | null;
  expires_at: string | null;
  provisioning_status: string;
  payment: {
    amount: string | null;
    status: string | null;
    provider: string | null;
  };
}

interface SearchResult {
  count: number;
  results: VoucherRow[];
}

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [FormsModule, DatePipe, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Vouchers / Support</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Portal (wajinunulia) + agent — orodha ya karibuni, au tafuta kwa simu/code/MAC
        </p>
      </div>

      <div class="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 font-semibold"
          [class]="
            source() === 'all'
              ? 'bg-signal text-[var(--text-inverse)]'
              : 'bg-surface-2 text-[var(--text-secondary)]'
          "
          (click)="setSource('all')"
        >
          Zote
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 font-semibold"
          [class]="
            source() === 'portal'
              ? 'bg-signal text-[var(--text-inverse)]'
              : 'bg-surface-2 text-[var(--text-secondary)]'
          "
          (click)="setSource('portal')"
        >
          Portal (wajinunulia)
        </button>
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 font-semibold"
          [class]="
            source() === 'agent'
              ? 'bg-signal text-[var(--text-inverse)]'
              : 'bg-surface-2 text-[var(--text-secondary)]'
          "
          (click)="setSource('agent')"
        >
          Agents
        </button>
      </div>

      <form
        class="grid gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-3"
        (ngSubmit)="search()"
      >
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Simu</span>
          <input
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [(ngModel)]="phone"
            name="phone"
            placeholder="2557…"
            autocomplete="tel"
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Code</span>
          <input
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 font-mono text-ink"
            [(ngModel)]="code"
            name="code"
            placeholder="username"
          />
        </label>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">MAC</span>
          <input
            class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 font-mono text-ink"
            [(ngModel)]="mac"
            name="mac"
            placeholder="AA:BB:…"
          />
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
        <div class="flex items-end gap-2">
          <button
            type="submit"
            class="w-full rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-[var(--text-inverse)] disabled:opacity-50"
            [disabled]="loading()"
          >
            {{ loading() ? 'Inatafuta…' : 'Tafuta' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
            (click)="clearAndRecent()"
          >
            Onyesha karibuni
          </button>
        </div>
      </form>

      @if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      }

      @if (loading()) {
        <app-skeleton height="10rem" />
      } @else if (searched()) {
        <div class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
          <p class="text-sm text-[var(--text-secondary)]">
            Matokeo: <span class="font-semibold text-ink">{{ count() }}</span>
            <span class="ml-2 text-xs">(inaonyesha hadi 50 za mwisho)</span>
          </p>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[82rem] text-left text-sm">
              <thead class="border-b border-border text-[var(--text-secondary)]">
                <tr>
                  <th class="px-2 py-2 font-semibold">Code</th>
                  <th class="px-2 py-2 font-semibold">Chanzo</th>
                  <th class="px-2 py-2 font-semibold">Simu</th>
                  <th class="px-2 py-2 font-semibold">Package</th>
                  <th class="px-2 py-2 font-semibold">Matumizi</th>
                  <th class="px-2 py-2 font-semibold">Session</th>
                  <th class="px-2 py-2 font-semibold">Speed</th>
                  <th class="px-2 py-2 font-semibold">Site</th>
                  <th class="px-2 py-2 font-semibold">Hali</th>
                  <th class="px-2 py-2 font-semibold">Tarehe</th>
                </tr>
              </thead>
              <tbody>
                @for (v of results(); track v.id) {
                  <tr class="border-b border-border/70 align-top">
                    <td class="px-2 py-3">
                      <p class="font-mono font-semibold text-signal">{{ v.username }}</p>
                      <p class="text-xs capitalize text-[var(--text-secondary)]">
                        {{ v.purchase_type }}
                      </p>
                    </td>
                    <td class="px-2 py-3">
                      @if (v.source === 'agent') {
                        <span class="font-semibold text-ink">Agent</span>
                        <p class="text-xs text-[var(--text-secondary)]">
                          {{ v.agent_name || v.agent_code || '—' }}
                        </p>
                      } @else {
                        <span class="font-semibold text-signal">Portal</span>
                        <p class="text-xs text-[var(--text-secondary)]">Amejinunulia</p>
                      }
                    </td>
                    <td class="px-2 py-3 font-mono text-ink">{{ v.phone_number }}</td>
                    <td class="px-2 py-3 text-ink">
                      {{ v.package_name }}
                      @if (v.payment.amount) {
                        <p class="text-xs text-[var(--text-secondary)]">
                          TZS {{ v.payment.amount }} · {{ v.payment.provider }}
                        </p>
                      }
                    </td>
                    <td class="px-2 py-3">
                      @if (v.is_used || v.mac_address) {
                        <span
                          class="font-semibold"
                          [class.text-success]="v.is_online"
                          [class.text-signal]="!v.is_online"
                        >
                          {{ v.is_online ? 'IN USE' : 'Imetumika' }}
                        </span>
                        <p class="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">
                          MAC: {{ v.mac_address || '—' }}
                        </p>
                        <p class="text-xs text-ink">
                          Kifaa: {{ v.bound_device_name || 'Hakijulikani' }}
                        </p>
                      } @else {
                        <span class="text-[var(--text-secondary)]">Haijatumika</span>
                      }
                    </td>
                    <td class="px-2 py-3 text-xs text-[var(--text-secondary)]">
                      <p>
                        Ilianza:
                        {{ (v.validity_started_at || v.session_started_at) | date: 'medium' }}
                      </p>
                      <p>Inaisha: {{ v.expires_at ? (v.expires_at | date: 'medium') : '—' }}</p>
                      @if (v.is_online) {
                        <p class="mt-1 font-semibold text-success">
                          Online {{ v.session_uptime || '' }}
                        </p>
                      } @else if (v.session_last_seen_at) {
                        <p class="mt-1">Last seen: {{ v.session_last_seen_at | date: 'medium' }}</p>
                      }
                    </td>
                    <td class="px-2 py-3 text-xs text-[var(--text-secondary)]">
                      @if (v.is_online) {
                        <p>↓ {{ formatSpeed(v.session_bps_out) }}</p>
                        <p>↑ {{ formatSpeed(v.session_bps_in) }}</p>
                      } @else {
                        —
                      }
                    </td>
                    <td class="px-2 py-3 text-[var(--text-secondary)]">
                      {{ v.site_name }}
                      <p class="text-xs">{{ v.node_identifier }}</p>
                    </td>
                    <td class="px-2 py-3">
                      <span
                        [class]="
                          v.usage_status === 'active' || v.usage_status === 'in_use'
                            ? 'text-success'
                            : v.usage_status === 'in_use_expired' || v.status === 'expired' || v.status === 'failed'
                              ? 'text-danger'
                              : 'text-signal'
                        "
                      >
                        {{
                          v.usage_status === 'in_use'
                            ? 'IN USE'
                            : v.usage_status === 'in_use_expired'
                              ? 'IN USE · EXPIRED'
                              : v.usage_status
                        }}
                      </span>
                    </td>
                    <td class="px-2 py-3 text-xs text-[var(--text-secondary)]">
                      {{ v.purchased_at | date: 'medium' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10" class="px-2 py-8 text-[var(--text-secondary)]">
                      Hakuna voucher. Hakikisha unatazama filter sahihi (Portal vs Agents).
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
  `,
})
export class AdminSupportComponent implements OnInit {
  private readonly api = inject(ApiClient);

  phone = '';
  code = '';
  mac = '';
  dateFrom = '';
  dateTo = '';

  readonly source = signal<'all' | 'portal' | 'agent'>('portal');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searched = signal(false);
  readonly count = signal(0);
  readonly results = signal<VoucherRow[]>([]);

  ngOnInit(): void {
    this.loadRecent();
  }

  formatSpeed(value: number): string {
    const bps = Math.max(Number(value) || 0, 0);
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
    return `${Math.round(bps)} bps`;
  }

  setSource(s: 'all' | 'portal' | 'agent'): void {
    this.source.set(s);
    this.loadRecent();
  }

  clearAndRecent(): void {
    this.phone = '';
    this.code = '';
    this.mac = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.loadRecent();
  }

  search(): void {
    const hasFilter = !!(
      this.phone.trim() ||
      this.code.trim() ||
      this.mac.trim() ||
      this.dateFrom ||
      this.dateTo
    );
    if (!hasFilter) {
      this.loadRecent();
      return;
    }
    this.fetch({
      phone: this.phone.trim() || undefined,
      code: this.code.trim() || undefined,
      mac: this.mac.trim() || undefined,
      purchased_from: this.dateFrom || undefined,
      purchased_to: this.dateTo || undefined,
      source: this.source() === 'all' ? undefined : this.source(),
      page_size: 50,
    });
  }

  private loadRecent(): void {
    this.fetch({
      recent: '1',
      source: this.source() === 'all' ? undefined : this.source(),
      page_size: 50,
    });
  }

  private fetch(params: Record<string, string | number | undefined>): void {
    this.error.set(null);
    this.loading.set(true);
    this.searched.set(true);
    this.api.get<SearchResult>('/admin/vouchers/', params).subscribe({
      next: (data) => {
        this.count.set(data.count);
        this.results.set(data.results ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.results.set([]);
        this.count.set(0);
        this.loading.set(false);
      },
    });
  }
}
