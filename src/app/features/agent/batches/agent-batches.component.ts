import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface DebtSummary {
  unpaid_total: string;
  unpaid_batches: number;
  unpaid_vouchers: number;
  currency: string;
  has_debt: boolean;
}

interface VoucherRow {
  id: string;
  batch_id: string;
  line_no: number;
  package_name: string;
  amount: string;
  currency: string;
  voucher_code: string | null;
  provisioning_status: string;
  settlement_status: string;
  settlement_mode: string;
  is_unpaid: boolean;
  is_used: boolean;
  mac_address: string;
  device_name: string;
  site_name: string;
  node_identifier: string;
  issued_at: string;
}

interface BatchRow {
  id: string;
  created_at: string;
  quantity: number;
  settlement_mode: string;
  settlement_status: string;
  total_amount: string;
  package_name_snapshot: string;
  site_name: string;
  node_identifier: string;
}

interface BatchItem {
  line_no: number;
  voucher_code: string | null;
  provisioning_status: string;
  package_name?: string;
  amount?: string;
  is_used?: boolean;
  mac_address?: string;
  device_name?: string;
}

interface BatchDetail extends BatchRow {
  items: BatchItem[];
  notes: string;
}

@Component({
  selector: 'app-agent-batches',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      @if (detailId()) {
        <div>
          <a routerLink="/agent" class="text-sm font-semibold text-signal no-underline">← Vouchers</a>
          @if (detailLoading()) {
            <app-skeleton height="10rem" class="mt-4" />
          } @else if (detail(); as b) {
            <div class="mt-4 space-y-4">
              <div>
                <h1 class="font-display text-2xl font-bold text-ink">
                  {{ b.package_name_snapshot }}
                </h1>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">
                  {{ b.site_name }} · {{ b.node_identifier }} · {{ b.created_at | date: 'medium' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-3 text-sm">
                <span class="rounded-full bg-surface-2 px-3 py-1 text-ink">
                  {{ b.quantity }} vouchers
                </span>
                <span
                  class="rounded-full px-3 py-1"
                  [class]="
                    b.settlement_status === 'unpaid'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-success/20 text-success'
                  "
                >
                  {{ statusLabel(b) }}
                </span>
                <span class="rounded-full bg-signal-muted px-3 py-1 font-semibold text-signal">
                  TZS {{ b.total_amount | number: '1.0-0' }}
                </span>
              </div>
              <ul class="divide-y divide-border rounded-2xl border border-border bg-surface-1">
                @for (item of b.items; track item.line_no) {
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p class="font-mono text-signal">{{ item.voucher_code || 'pending…' }}</p>
                      <p class="text-xs text-[var(--text-secondary)]">
                        {{ item.package_name || b.package_name_snapshot }}
                      </p>
                      @if (item.is_used) {
                        <p class="mt-1 text-xs text-signal">Imetumika</p>
                        <p class="font-mono text-xs text-[var(--text-secondary)]">
                          MAC: {{ item.mac_address || '—' }}
                        </p>
                        <p class="text-xs text-ink">
                          Kifaa: {{ item.device_name || 'Hakijulikani' }}
                        </p>
                      } @else {
                        <p class="mt-1 text-xs text-[var(--text-secondary)]">Haijatumika</p>
                      }
                    </div>
                    <div class="text-right text-xs text-[var(--text-secondary)]">
                      <p>{{ item.provisioning_status }}</p>
                      @if (item.amount) {
                        <p>TZS {{ item.amount | number: '1.0-0' }}</p>
                      }
                    </div>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      } @else {
        <div>
          <h1 class="font-display text-2xl font-bold text-ink">Vouchers zangu</h1>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            Kila voucher na package yake — zilizotolewa na admin
          </p>
        </div>

        @if (debt(); as d) {
          @if (d.has_debt) {
            <div class="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-4">
              <p class="text-sm font-semibold text-warning">Deni unalodaiwa</p>
              <p class="mt-1 font-display text-2xl font-bold text-ink">
                TZS {{ d.unpaid_total | number: '1.0-0' }}
              </p>
              <p class="mt-1 text-xs text-[var(--text-secondary)]">
                {{ d.unpaid_vouchers }} vouchers · {{ d.unpaid_batches }} batches bado hazijalipwa
              </p>
            </div>
          } @else {
            <div class="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              Hakuna deni — batches zote zimesettled.
            </div>
          }
        }

        <div class="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            class="rounded-xl px-3 py-1.5 font-semibold"
            [class]="
              filter() === 'all'
                ? 'bg-signal text-[var(--text-inverse)]'
                : 'bg-surface-2 text-[var(--text-secondary)]'
            "
            (click)="setFilter('all')"
          >
            Zote
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-1.5 font-semibold"
            [class]="
              filter() === 'unpaid'
                ? 'bg-signal text-[var(--text-inverse)]'
                : 'bg-surface-2 text-[var(--text-secondary)]'
            "
            (click)="setFilter('unpaid')"
          >
            Zenye deni
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-1.5 font-semibold"
            [class]="
              filter() === 'paid'
                ? 'bg-signal text-[var(--text-inverse)]'
                : 'bg-surface-2 text-[var(--text-secondary)]'
            "
            (click)="setFilter('paid')"
          >
            Zilizolipwa
          </button>
        </div>

        @if (listLoading()) {
          <app-skeleton height="8rem" />
        } @else if (error()) {
          <app-error-state title="Hitilafu" [message]="error()!" />
        } @else if (!vouchers().length) {
          <p class="text-sm text-[var(--text-secondary)]">
            Hakuna vouchers. Admin atakutengenezea kwenye Admin → Agents.
          </p>
        } @else {
          <div class="overflow-x-auto rounded-2xl border border-border bg-surface-1 shadow-soft">
            <table class="w-full min-w-[44rem] text-left text-sm">
              <thead class="border-b border-border text-[var(--text-secondary)]">
                <tr>
                  <th class="px-4 py-3 font-semibold">Voucher</th>
                  <th class="px-4 py-3 font-semibold">Package</th>
                  <th class="px-4 py-3 font-semibold">Bei</th>
                  <th class="px-4 py-3 font-semibold">Matumizi</th>
                  <th class="px-4 py-3 font-semibold">Hali</th>
                  <th class="px-4 py-3 font-semibold">Tarehe</th>
                </tr>
              </thead>
              <tbody>
                @for (v of vouchers(); track v.id) {
                  <tr class="border-b border-border/70">
                    <td class="px-4 py-3">
                      <a
                        [routerLink]="['/agent/batches', v.batch_id]"
                        class="font-mono font-semibold text-signal no-underline"
                      >
                        {{ v.voucher_code || 'pending…' }}
                      </a>
                      <p class="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {{ v.site_name }} · {{ v.node_identifier }}
                      </p>
                    </td>
                    <td class="px-4 py-3 text-ink">{{ v.package_name }}</td>
                    <td class="px-4 py-3 text-[var(--text-secondary)]">
                      TZS {{ v.amount | number: '1.0-0' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (v.is_used) {
                        <span class="font-semibold text-signal">Imetumika</span>
                        <p class="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">
                          MAC: {{ v.mac_address || '—' }}
                        </p>
                        <p class="text-xs text-ink">
                          Kifaa: {{ v.device_name || 'Hakijulikani' }}
                        </p>
                      } @else {
                        <span class="text-[var(--text-secondary)]">Haijatumika</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span [class]="v.is_unpaid ? 'text-warning' : 'text-success'">
                        {{ v.is_unpaid ? 'Deni' : 'Imelipwa' }}
                      </span>
                      <p class="text-xs text-[var(--text-secondary)]">{{ v.provisioning_status }}</p>
                    </td>
                    <td class="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {{ v.issued_at | date: 'short' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class AgentBatchesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly vouchers = signal<VoucherRow[]>([]);
  readonly debt = signal<DebtSummary | null>(null);
  readonly detail = signal<BatchDetail | null>(null);
  readonly detailId = signal<string | null>(null);
  readonly filter = signal<'all' | 'unpaid' | 'paid'>('all');
  readonly listLoading = signal(true);
  readonly detailLoading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<DebtSummary>('/agent/debt/').subscribe({
      next: (d) => this.debt.set(d),
    });
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      this.detailId.set(id);
      this.error.set(null);
      if (id) {
        this.loadDetail(id);
      } else {
        this.loadVouchers();
      }
    });
  }

  setFilter(f: 'all' | 'unpaid' | 'paid'): void {
    this.filter.set(f);
    this.loadVouchers();
  }

  statusLabel(b: Pick<BatchRow, 'settlement_mode' | 'settlement_status'>): string {
    if (b.settlement_status === 'unpaid') return 'Haijalipwa (deni)';
    if (b.settlement_status === 'settled' || b.settlement_mode === 'pay_all') return 'Imelipwa';
    return b.settlement_status;
  }

  private loadVouchers(): void {
    this.listLoading.set(true);
    const params: Record<string, string> = {};
    if (this.filter() === 'unpaid') params['unpaid'] = 'true';
    if (this.filter() === 'paid') params['unpaid'] = 'false';
    this.api.get<VoucherRow[]>('/agent/vouchers/', params).subscribe({
      next: (res) => {
        this.vouchers.set(Array.isArray(res) ? res : []);
        this.listLoading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.listLoading.set(false);
      },
    });
  }

  private loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.api.get<BatchDetail>(`/agent/batches/${id}/`).subscribe({
      next: (b) => {
        this.detail.set(b);
        this.detailLoading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.detailLoading.set(false);
      },
    });
  }
}
