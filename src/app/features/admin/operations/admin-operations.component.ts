import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';

interface PaymentRow {
  id: string;
  external_id: string;
  gateway: string;
  provider: string;
  status: string;
  amount: string;
  currency: string;
  phone_number: string;
  site_name: string;
  package_name: string;
  payment_source: string;
  created_at: string;
  is_stale: boolean;
  fulfillment: { status: string; error_category: string };
  reconciliation: { status: string; attempts: number; last_at: string | null };
}
interface JobRow {
  id: string;
  payment_id?: string;
  voucher_id?: string;
  site_name: string;
  node_identifier: string;
  package_name?: string;
  status: string;
  attempts: number;
  error_category: string;
  last_attempt_at: string | null;
  commercially_revoked?: boolean;
}
interface Anomaly {
  type: string;
  payment_id: string;
  voucher_id?: string;
  site_name: string;
}

@Component({
  selector: 'app-admin-operations',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  template: ` <section class="space-y-5">
    <div>
      <h1 class="font-display text-2xl font-bold text-ink">Payments & Operations</h1>
      <p class="mt-1 text-sm text-[var(--text-secondary)]">
        Scoped payment visibility and safe recovery controls
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      @for (
        item of ['payments', 'provisioning', 'revocation', 'router-enforcement', 'anomalies'];
        track item
      ) {
        <a
          routerLink="/admin/operations"
          [queryParams]="{ tab: item }"
          class="rounded-xl px-3 py-2 text-sm font-semibold"
          [class]="
            tab() === item
              ? 'bg-signal text-[var(--text-inverse)]'
              : 'bg-surface-2 text-[var(--text-secondary)]'
          "
          >{{ item }}</a
        >
      }
    </div>
    @if (operationStatus()) {
      <div
        class="flex items-center gap-3 rounded-xl border border-signal/30 bg-signal-muted px-4 py-2 text-sm"
      >
        Status: <strong>{{ operationStatus() }}</strong
        ><a
          routerLink="/admin/operations"
          [queryParams]="{ tab: tab() }"
          class="text-signal underline"
          >Clear filter</a
        >
      </div>
    }
    @if (tab() === 'payments') {
      <div class="grid gap-2 sm:grid-cols-4">
        <input
          class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm"
          [(ngModel)]="phone"
          placeholder="Exact customer phone"
        /><select
          class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm"
          [(ngModel)]="status"
        >
          <option value="">All statuses</option>
          <option>pending</option>
          <option>success</option>
          <option>failed</option>
          <option>expired</option></select
        ><select
          class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm"
          [(ngModel)]="source"
        >
          <option value="">All sources</option>
          <option value="customer">Customer</option>
          <option value="agent_accounting">Agent accounting</option></select
        ><button
          class="rounded-xl bg-signal px-3 py-2 text-sm font-semibold text-[var(--text-inverse)]"
          (click)="applyFilters()"
        >
          Filter
        </button>
      </div>
      <div class="overflow-x-auto rounded-2xl border border-border">
        <table class="w-full min-w-[55rem] text-left text-sm">
          <thead>
            <tr class="border-b border-border text-[var(--text-secondary)]">
              <th class="p-3">Reference</th>
              <th>Customer</th>
              <th>Gateway</th>
              <th>Site / package</th>
              <th>Status</th>
              <th>Fulfillment</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of payments(); track p.id) {
              <tr class="border-b border-border/70">
                <td class="p-3 font-mono text-xs">{{ p.external_id }}</td>
                <td>{{ p.phone_number }}</td>
                <td>{{ p.gateway }} / {{ p.provider }}</td>
                <td>
                  {{ p.site_name }}<br /><span class="text-xs text-[var(--text-secondary)]">{{
                    p.package_name
                  }}</span>
                </td>
                <td>
                  {{ p.status }}
                  @if (p.is_stale) {
                    <span class="text-warning">stale</span>
                  }
                </td>
                <td>{{ p.fulfillment.status }}</td>
                <td>{{ p.currency }} {{ p.amount | number: '1.0-0' }}</td>
                <td>
                  <button class="mr-3 text-signal" (click)="openPayment(p.id)">Details</button>
                  @if (p.gateway === 'pesapal' && canRecover) {
                    <button class="text-signal" (click)="pendingPayment = p">Reconcile</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (
      tab() === 'provisioning' || tab() === 'revocation' || tab() === 'router-enforcement'
    ) {
      <div class="space-y-2">
        @for (j of jobs(); track j.id) {
          <div
            class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-sm"
          >
            <div>
              <p class="font-semibold text-ink">{{ j.site_name }} · {{ j.node_identifier }}</p>
              <p class="text-[var(--text-secondary)]">
                {{ j.package_name || 'Voucher ' + j.voucher_id }} · {{ j.status }} · attempts
                {{ j.attempts }} · {{ j.error_category }}
              </p>
            </div>
            @if (canRecover && tab() !== 'router-enforcement') {
              <button
                class="rounded-xl bg-signal px-3 py-2 font-semibold text-[var(--text-inverse)]"
                (click)="pendingJob = j"
              >
                Retry safely
              </button>
            }
          </div>
        }
      </div>
    } @else {
      <div class="space-y-2">
        @for (a of anomalies(); track a.type + a.payment_id) {
          <div class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
            <strong>{{ a.type }}</strong> · {{ a.site_name }} ·
            <span class="font-mono">{{ a.payment_id }}</span>
          </div>
        }
      </div>
    }
    @if (error()) {
      <p class="rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{{ error() }}</p>
    }
    @if (pendingPayment || pendingJob) {
      <section class="rounded-xl border border-border bg-surface-1 p-5">
        <h2 class="font-semibold">Confirm operational action</h2>
        <p class="my-3 text-sm">
          This requests an authoritative status check or retries the existing recovery job. It does
          not change payment providers or create another payment.
        </p>
        <button class="mr-3 text-signal" [disabled]="busy()" (click)="confirmOperation()">
          Confirm</button
        ><button (click)="pendingPayment = null; pendingJob = null">Cancel</button>
      </section>
    }
    @if (tab() !== 'anomalies') {
      <nav class="flex items-center justify-end gap-3 text-sm">
        <span>{{ count() }} records · Page {{ page() }}</span
        ><button [disabled]="page() <= 1" (click)="move(-1)">Previous</button
        ><button [disabled]="!hasNext()" (click)="move(1)">Next</button>
      </nav>
    }
    @if (selected(); as p) {
      <section class="rounded-2xl border border-border bg-surface-1 p-5">
        <div class="flex justify-between">
          <h2 class="font-display text-lg font-bold">Payment details</h2>
          <button class="text-signal" (click)="openPayment(null)">Close</button>
        </div>
        <dl class="mt-5 grid gap-4 sm:grid-cols-3">
          @for (
            k of [
              'merchant_reference',
              'provider_reference',
              'gateway',
              'status',
              'amount',
              'currency',
              'package_name',
              'site_name',
              'node_identifier',
              'created_at',
            ];
            track k
          ) {
            <div>
              <dt class="text-xs text-[var(--text-secondary)]">{{ k.replaceAll('_', ' ') }}</dt>
              <dd class="mt-1 break-words text-sm">{{ p[k] || '—' }}</dd>
            </div>
          }
        </dl>
        <p class="mt-5 text-sm">
          Reconciliation: {{ p['reconciliation']?.status }} · Fulfilment:
          {{ p['fulfillment']?.status }}
        </p>
        <a
          class="mt-3 block text-sm text-signal"
          routerLink="/admin/payment-audit"
          [queryParams]="{ payment: p['id'] }"
          >View payment audit</a
        >
        @for (e of p['audit'] || []; track $index) {
          <p class="mt-2 text-xs">{{ e.at }} · {{ e.type }} · {{ e.previous }} → {{ e.result }}</p>
        }
      </section>
    }
  </section>`,
})
export class AdminOperationsComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly tab = signal('payments');
  readonly payments = signal<PaymentRow[]>([]);
  readonly jobs = signal<JobRow[]>([]);
  readonly anomalies = signal<Anomaly[]>([]);
  readonly operationStatus = signal('');
  readonly range = signal('');
  readonly selected = signal<Record<string, any> | null>(null);
  readonly page = signal(1);
  readonly count = signal(0);
  readonly hasNext = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  phone = '';
  status = '';
  source = '';
  pendingPayment: PaymentRow | null = null;
  pendingJob: JobRow | null = null;
  get canRecover() {
    return this.auth.user()?.role !== 'support';
  }
  ngOnInit() {
    this.route.queryParamMap.subscribe((p) => {
      this.phone = p.get('phone') || '';
      this.status = p.get('status') || '';
      this.source = p.get('source') || '';
      this.page.set(Number(p.get('page')) || 1);
      this.operationStatus.set(this.status);
      this.range.set(p.get('range') || '');
      this.select(p.get('tab') || 'payments');
      this.selected.set(null);
      if (p.get('payment'))
        this.api
          .get<Record<string, any>>(`/admin/payments/${p.get('payment')}/`)
          .subscribe({
            next: (x) => this.selected.set(x),
            error: (e) => this.error.set(e.message),
          });
    });
  }
  applyFilters() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        phone: this.phone || null,
        status: this.status || null,
        source: this.source || null,
        page: 1,
      },
      queryParamsHandling: 'merge',
    });
  }
  openPayment(id: string | null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { payment: id },
      queryParamsHandling: 'merge',
    });
  }
  move(delta: number) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.page() + delta },
      queryParamsHandling: 'merge',
    });
  }
  select(tab: string) {
    this.tab.set(
      ['payments', 'provisioning', 'revocation', 'router-enforcement', 'anomalies'].includes(tab)
        ? tab
        : 'payments',
    );
    this.error.set('');
    if (this.tab() === 'payments') this.loadPayments();
    else if (this.tab() === 'anomalies')
      this.api
        .get<Anomaly[]>('/admin/operations/anomalies/')
        .subscribe({ next: (x) => this.anomalies.set(x), error: (e) => this.error.set(e.message) });
    else
      this.api
        .getPage<JobRow>(`/admin/operations/${this.tab()}/`, {
          status: this.operationStatus(),
          range: this.range(),
          page: this.page(),
          page_size: 25,
        })
        .subscribe({
          next: (x) => {
            this.jobs.set(x.rows);
            this.count.set(x.count);
            this.hasNext.set(x.next);
          },
          error: (e) => this.error.set(e.message),
        });
  }
  loadPayments() {
    this.api
      .getPage<PaymentRow>('/admin/payments/', {
        phone: this.phone,
        succeeded_from: this.route.snapshot.queryParamMap.get('succeeded_from'),
        succeeded_to: this.route.snapshot.queryParamMap.get('succeeded_to'),
        status: this.status,
        source: this.source,
        page: this.page(),
        page_size: 25,
      })
      .subscribe({
        next: (x) => {
          this.payments.set(x.rows);
          this.count.set(x.count);
          this.hasNext.set(x.next);
        },
        error: (e) => this.error.set(e.message),
      });
  }
  confirmOperation() {
    if (this.busy()) return;
    const payment = this.pendingPayment;
    const job = this.pendingJob;
    const path = payment
      ? `/admin/payments/${payment.id}/reconcile/`
      : job
        ? `/admin/operations/${this.tab()}/${job.id}/retry/`
        : '';
    if (!path) return;
    this.busy.set(true);
    this.api.post(path, {}).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingPayment = null;
        this.pendingJob = null;
        this.select(this.tab());
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }
}
