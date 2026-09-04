import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';

interface PaymentRow { id: string; external_id: string; gateway: string; provider: string; status: string; amount: string; currency: string; phone_number: string; site_name: string; package_name: string; payment_source: string; created_at: string; is_stale: boolean; fulfillment: { status: string; error_category: string }; reconciliation: { status: string; attempts: number; last_at: string | null }; }
interface JobRow { id: string; payment_id?: string; voucher_id?: string; site_name: string; node_identifier: string; package_name?: string; status: string; attempts: number; error_category: string; last_attempt_at: string | null; commercially_revoked?: boolean; }
interface Anomaly { type: string; payment_id: string; voucher_id?: string; site_name: string; }

@Component({
  selector: 'app-admin-operations', standalone: true, imports: [FormsModule, DecimalPipe, RouterLink],
  template: `
    <section class="space-y-5">
      <div><h1 class="font-display text-2xl font-bold text-ink">Payments & Operations</h1><p class="mt-1 text-sm text-[var(--text-secondary)]">Scoped payment visibility and safe recovery controls</p></div>
      <div class="flex flex-wrap gap-2">
        @for (item of ['payments','provisioning','revocation','router-enforcement','anomalies']; track item) { <a routerLink="/admin/operations" [queryParams]="{tab:item}" class="rounded-xl px-3 py-2 text-sm font-semibold" [class]="tab() === item ? 'bg-signal text-[var(--text-inverse)]' : 'bg-surface-2 text-[var(--text-secondary)]'">{{ item }}</a> }
      </div>
      @if (operationStatus()) {<div class="flex items-center gap-3 rounded-xl border border-signal/30 bg-signal-muted px-4 py-2 text-sm">Status: <strong>{{ operationStatus() }}</strong><a routerLink="/admin/operations" [queryParams]="{tab:tab()}" class="text-signal underline">Clear filter</a></div>}
      @if (tab() === 'payments') {
        <div class="grid gap-2 sm:grid-cols-4"><input class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm" [(ngModel)]="phone" placeholder="Exact customer phone"><select class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm" [(ngModel)]="status"><option value="">All statuses</option><option>pending</option><option>success</option><option>failed</option><option>expired</option></select><select class="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm" [(ngModel)]="source"><option value="">All sources</option><option value="customer">Customer</option><option value="agent_accounting">Agent accounting</option></select><button class="rounded-xl bg-signal px-3 py-2 text-sm font-semibold text-[var(--text-inverse)]" (click)="loadPayments()">Filter</button></div>
        <div class="overflow-x-auto rounded-2xl border border-border"><table class="w-full min-w-[55rem] text-left text-sm"><thead><tr class="border-b border-border text-[var(--text-secondary)]"><th class="p-3">Reference</th><th>Customer</th><th>Gateway</th><th>Site / package</th><th>Status</th><th>Fulfillment</th><th>Amount</th><th></th></tr></thead><tbody>@for (p of payments(); track p.id) {<tr class="border-b border-border/70"><td class="p-3 font-mono text-xs">{{ p.external_id }}</td><td>{{ p.phone_number }}</td><td>{{ p.gateway }} / {{ p.provider }}</td><td>{{ p.site_name }}<br><span class="text-xs text-[var(--text-secondary)]">{{ p.package_name }}</span></td><td>{{ p.status }} @if(p.is_stale){<span class="text-warning">stale</span>}</td><td>{{ p.fulfillment.status }}</td><td>{{ p.currency }} {{ p.amount | number:'1.0-0' }}</td><td>@if (p.gateway === 'pesapal' && canRecover) {<button class="text-signal" (click)="reconcile(p)">Reconcile</button>}</td></tr>}</tbody></table></div>
      } @else if (tab() === 'provisioning' || tab() === 'revocation' || tab() === 'router-enforcement') {
        <div class="space-y-2">@for (j of jobs(); track j.id) {<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-sm"><div><p class="font-semibold text-ink">{{ j.site_name }} · {{ j.node_identifier }}</p><p class="text-[var(--text-secondary)]">{{ j.package_name || ('Voucher ' + j.voucher_id) }} · {{ j.status }} · attempts {{ j.attempts }} · {{ j.error_category }}</p></div>@if(canRecover && tab() !== 'router-enforcement'){<button class="rounded-xl bg-signal px-3 py-2 font-semibold text-[var(--text-inverse)]" (click)="retry(j)">Retry safely</button>}</div>}</div>
      } @else { <div class="space-y-2">@for(a of anomalies(); track a.type + a.payment_id){<div class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"><strong>{{ a.type }}</strong> · {{ a.site_name }} · <span class="font-mono">{{ a.payment_id }}</span></div>}</div> }
    </section>`,
})
export class AdminOperationsComponent implements OnInit {
  private readonly api = inject(ApiClient); private readonly auth = inject(AuthService); private readonly route = inject(ActivatedRoute);
  readonly tab = signal('payments'); readonly payments = signal<PaymentRow[]>([]); readonly jobs = signal<JobRow[]>([]); readonly anomalies = signal<Anomaly[]>([]);
  readonly operationStatus = signal(''); readonly range = signal('');
  phone = ''; status = ''; source = ''; get canRecover(): boolean { return this.auth.user()?.role !== 'support'; }
  ngOnInit(): void { this.route.queryParamMap.subscribe(p => { this.operationStatus.set(p.get('status') || ''); this.range.set(p.get('range') || ''); this.select(p.get('tab') || 'payments'); }); }
  select(tab: string): void { this.tab.set(tab); if(tab === 'payments') this.loadPayments(); else if(tab === 'anomalies') this.api.get<Anomaly[]>('/admin/operations/anomalies/').subscribe(x => this.anomalies.set(x)); else this.api.get<JobRow[]>(`/admin/operations/${tab}/`, {status:this.operationStatus(), range:this.range()}).subscribe(x => this.jobs.set(x)); }
  loadPayments(): void { this.api.get<PaymentRow[]>('/admin/payments/', { phone: this.phone, status: this.status, source: this.source }).subscribe(x => this.payments.set(x)); }
  reconcile(payment: PaymentRow): void { this.api.post<PaymentRow>(`/admin/payments/${payment.id}/reconcile/`, {}).subscribe(() => this.loadPayments()); }
  retry(job: JobRow): void { this.api.post<JobRow>(`/admin/operations/${this.tab()}/${job.id}/retry/`, {}).subscribe(() => this.select(this.tab())); }
}
