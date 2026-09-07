import { VoucherCardComponent, VoucherSummaryComponent } from '../../../shared/ui/voucher-card.component';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { createIdempotencyKey } from '../../../core/api/idempotency-key';
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
  issuance_request: string | null;
  created_at: string;
  quantity: number;
  settlement_mode: string;
  settlement_status: string;
  total_amount: string;
  package_name_snapshot: string;
  site_name: string;
  node_identifier: string;
}

interface MainBatch {
  id: string;
  lines: BatchRow[];
  quantity: number;
  totalAmount: number;
  siteName: string;
  nodeIdentifier: string;
  createdAt: string;
  groupedIssuance: boolean;
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
  voucher_password?: string | null;
  barcode_svg?: string | null;
  lifecycle_status?: string;
  source?: string;
  activation_policy?: string;
  activated_at?: string | null;
  expires_at?: string | null;
  sell_by_at?: string | null;
}

interface BatchDetail extends BatchRow {
  items: BatchItem[];
  notes: string;
}

interface PrintJob {
  id: string;
  print_number: number;
  voucher_count: number;
  generated_at: string;
}

interface PrintInfo {
  eligibility: { total: number; eligible: number; excluded: number };
  permission: { enabled: boolean; assignment_status: string };
  history: PrintJob[];
}

@Component({
  selector: 'app-agent-batches',
  standalone: true,
  imports: [VoucherCardComponent, VoucherSummaryComponent, RouterLink, DecimalPipe, DatePipe, ErrorStateComponent, SkeletonComponent],
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
              <app-voucher-summary [items]="b.items" />
              @if (printInfo(); as info) {
                <div class="rounded-2xl border border-border bg-surface-1 p-4 text-sm">
                  <p class="font-semibold text-ink">Printable inventory</p>
                  <p class="mt-1 text-[var(--text-secondary)]">
                    {{ info.eligibility.eligible }} ready · {{ info.eligibility.excluded }} unavailable
                  </p>
                  @if (!info.permission.enabled) {
                    <p class="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
                      PDF printing has not been enabled by Admin.
                    </p>
                  } @else {
                  @if (info.history.length) {
                    <label class="mt-3 block">
                      <span class="text-xs font-semibold text-ink">Reason for reprint</span>
                      <input [value]="reprintReason()" (input)="reprintReason.set($any($event.target).value)" maxlength="255" placeholder="Why is another copy required?" class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink" />
                    </label>
                  }
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" class="rounded-xl bg-signal px-3 py-2 font-semibold text-[var(--text-inverse)] disabled:opacity-60" [disabled]="printing() || !info.eligibility.eligible" (click)="printBatch(b.id)">
                      {{ info.history.length ? 'Reprint PDF' : 'Generate PDF' }}
                    </button>
                    @if (info.history[0]; as latest) {
                      <button type="button" class="rounded-xl border border-border px-3 py-2 font-semibold text-signal" (click)="downloadPrint(latest.id)">Download print #{{ latest.print_number }}</button>
                    }
                  </div>
                  }
                </div>
              }
              <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                @for (item of b.items; track item.line_no) {
                  <li><app-voucher-card [voucher]="item" [number]="item.line_no" [packageName]="item.package_name || b.package_name_snapshot" /></li>
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

        <label class="block w-full max-w-md text-xs font-semibold text-[var(--text-secondary)]">Search inventory<input type="search" [value]="search()" (input)="updateSearch($event)" placeholder="Voucher, batch, package, site au node" class="mt-1 block w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm text-ink"></label>

        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Batch nilizopewa</h2>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">Unaweza kuona batch na vouchers zake wakati wowote. Kuchapisha PDF kunahitaji ruhusa ya Admin.</p>
          @if (batchesLoading()) {<app-skeleton height="6rem" class="mt-3" />}
          @else if (!filteredBatches().length) {<p class="mt-3 rounded-xl border border-border bg-surface-1 p-4 text-sm text-[var(--text-secondary)]">Hakuna batch inayolingana na search.</p>}
          @else {
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              @for (batch of pagedBatches(); track batch.id) {
                <article class="rounded-2xl border border-border bg-surface-1 p-4 shadow-soft">
                  <div class="flex items-start justify-between gap-3"><div><p class="font-display font-bold text-ink">Main Batch {{ shortId(batch.id) }}</p><p class="mt-1 text-xs text-[var(--text-secondary)]">{{ batch.siteName }} · {{ batch.nodeIdentifier }} · {{ batch.createdAt | date:'medium' }}</p></div><div class="text-right"><span class="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink">{{ batch.quantity }} vouchers</span><p class="mt-2 text-xs font-semibold text-signal">TZS {{ batch.totalAmount | number:'1.0-0' }}</p></div></div>
                  <div class="mt-4 space-y-2 border-t border-border pt-3">
                    @for (line of batch.lines; track line.id) {
                      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-0 p-3"><div><p class="font-semibold text-ink">{{ line.package_name_snapshot }}</p><p class="text-xs text-[var(--text-secondary)]">{{ line.quantity }} vouchers · {{ statusLabel(line) }}</p></div><a [routerLink]="['/agent/batches', line.id]" class="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-signal no-underline">View vouchers</a></div>
                    }
                  </div>
                  @if (mainPrintInfo()[batch.id]; as info) {
                    <div class="mt-4 border-t border-border pt-3">
                      @if (!info.permission.enabled) {<p class="rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">PDF printing haijaruhusiwa na Admin. Kuona batch na vouchers kumeruhusiwa.</p>}
                      @else {
                        @if (info.history.length) {<input [value]="mainReprintReasons()[batch.id] || ''" (input)="setMainReprintReason(batch.id,$event)" placeholder="Sababu ya reprint" class="mb-2 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-ink" />}
                        <button type="button" class="w-full rounded-xl bg-signal px-3 py-2.5 text-sm font-semibold text-[var(--text-inverse)] disabled:opacity-60" [disabled]="mainPrinting()===batch.id || !info.eligibility.eligible" (click)="printMainBatch(batch)">{{ mainPrinting()===batch.id ? 'Generating PDF…' : (info.history.length ? 'Reprint Main Batch PDF' : 'Print Main Batch PDF') }}</button>
                      }
                    </div>
                  }
                </article>
              }
            </div>
            <div class="mt-3 flex items-center justify-end gap-2 text-sm"><button type="button" class="rounded-lg border border-border px-3 py-2 disabled:opacity-40" [disabled]="batchPage()===1" (click)="moveBatch(-1)">Previous</button><span class="px-2 font-semibold">Page {{ batchPage() }} / {{ batchPageCount() }}</span><button type="button" class="rounded-lg border border-border px-3 py-2 disabled:opacity-40" [disabled]="batchPage()===batchPageCount()" (click)="moveBatch(1)">Next</button></div>
          }
        </div>

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
                @for (v of pagedVouchers(); track v.id) {
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
          <div class="flex items-center justify-end gap-2 text-sm"><button type="button" class="rounded-lg border border-border px-3 py-2 disabled:opacity-40" [disabled]="voucherPage()===1" (click)="moveVoucher(-1)">Previous</button><span class="px-2 font-semibold">Page {{ voucherPage() }} / {{ voucherPageCount() }}</span><button type="button" class="rounded-lg border border-border px-3 py-2 disabled:opacity-40" [disabled]="voucherPage()===voucherPageCount()" (click)="moveVoucher(1)">Next</button></div>
        }
      }
    </section>
  `,
})
export class AgentBatchesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly vouchers = signal<VoucherRow[]>([]);
  readonly batches = signal<BatchRow[]>([]);
  readonly search = signal('');
  readonly mainBatches = computed<MainBatch[]>(() => {const groups=new Map<string,BatchRow[]>();for(const line of this.batches()){const id=line.issuance_request||line.id;groups.set(id,[...(groups.get(id)||[]),line]);}return [...groups.entries()].map(([id,lines])=>({id,lines,quantity:lines.reduce((sum,line)=>sum+line.quantity,0),totalAmount:lines.reduce((sum,line)=>sum+Number(line.total_amount),0),siteName:lines[0].site_name,nodeIdentifier:lines[0].node_identifier,createdAt:lines[0].created_at,groupedIssuance:!!lines[0].issuance_request}));});
  readonly filteredBatches = computed(() => { const term=this.search().trim().toLowerCase();return term?this.mainBatches().filter(batch=>[batch.id,batch.siteName,batch.nodeIdentifier,...batch.lines.flatMap(line=>[line.package_name_snapshot,line.settlement_status])].some(value=>String(value||'').toLowerCase().includes(term))):this.mainBatches(); });
  readonly filteredVouchers = computed(() => { const term=this.search().trim().toLowerCase();return term?this.vouchers().filter(v=>[v.voucher_code,v.batch_id,v.package_name,v.site_name,v.node_identifier,v.provisioning_status].some(value=>String(value||'').toLowerCase().includes(term))):this.vouchers(); });
  readonly batchPage = signal(1);
  readonly voucherPage = signal(1);
  readonly batchPageCount = computed(() => Math.max(1,Math.ceil(this.filteredBatches().length/6)));
  readonly voucherPageCount = computed(() => Math.max(1,Math.ceil(this.filteredVouchers().length/10)));
  readonly pagedBatches = computed(() => this.filteredBatches().slice((this.batchPage()-1)*6,this.batchPage()*6));
  readonly pagedVouchers = computed(() => this.filteredVouchers().slice((this.voucherPage()-1)*10,this.voucherPage()*10));
  readonly debt = signal<DebtSummary | null>(null);
  readonly detail = signal<BatchDetail | null>(null);
  readonly detailId = signal<string | null>(null);
  readonly filter = signal<'all' | 'unpaid' | 'paid'>('all');
  readonly listLoading = signal(true);
  readonly batchesLoading = signal(true);
  readonly detailLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly printInfo = signal<PrintInfo | null>(null);
  readonly printing = signal(false);
  readonly reprintReason = signal('');
  readonly mainPrintInfo = signal<Record<string,PrintInfo>>({});
  readonly mainReprintReasons = signal<Record<string,string>>({});
  readonly mainPrinting = signal<string|null>(null);

  ngOnInit(): void {
    this.api.get<DebtSummary>('/agent/debt/').subscribe({
      next: (d) => this.debt.set(d),
    });
    this.loadBatches();
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
    this.voucherPage.set(1);
    this.loadVouchers();
  }

  shortId(id:string):string{return id.split('-')[0].toUpperCase();}
  updateSearch(event:Event):void{this.search.set((event.target as HTMLInputElement).value);this.batchPage.set(1);this.voucherPage.set(1);}
  moveBatch(delta:number):void{this.batchPage.update(page=>Math.min(this.batchPageCount(),Math.max(1,page+delta)));}
  moveVoucher(delta:number):void{this.voucherPage.update(page=>Math.min(this.voucherPageCount(),Math.max(1,page+delta)));}

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
        this.voucherPage.set(1);
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
        this.loadPrintInfo(id);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.detailLoading.set(false);
      },
    });
  }

  lifecycleLabel(item:BatchItem):string{const state=item.lifecycle_status||item.provisioning_status;return ({ready:'Tayari kutumika',pending:'Inatengenezwa',provisioning:'Inatengenezwa',activated:'Imetumika',expired:'Imeisha muda',revoked:'Imefutwa',failed:'Imeshindikana',success:'Tayari kutumika'} as Record<string,string>)[state]||state;}
  policyLabel(policy?:string):string{return policy==='first_use_activated'?'Muda unaanza voucher ikitumika':'Voucher ya agent';}
  private mainPrintEndpoint(batch:MainBatch):string{return batch.groupedIssuance?`/agent/issuances/${batch.id}/print/`:`/agent/batches/${batch.id}/print/`;}
  private loadMainPrintInfo(batch:MainBatch):void{this.api.get<PrintInfo>(this.mainPrintEndpoint(batch)).subscribe({next:info=>this.mainPrintInfo.update(all=>({...all,[batch.id]:info}))});}
  setMainReprintReason(id:string,event:Event):void{const value=(event.target as HTMLInputElement).value;this.mainReprintReasons.update(all=>({...all,[id]:value}));}
  printMainBatch(batch:MainBatch):void{const info=this.mainPrintInfo()[batch.id];const reason=(this.mainReprintReasons()[batch.id]||'').trim();if(info?.history.length&&reason.length<3){this.error.set('Weka sababu ya reprint yenye angalau herufi 3.');return;}this.mainPrinting.set(batch.id);this.api.post<PrintJob>(this.mainPrintEndpoint(batch),{reprint_reason:reason},{'Idempotency-Key':createIdempotencyKey()}).subscribe({next:job=>{this.mainPrinting.set(null);this.loadMainPrintInfo(batch);this.downloadPrint(job.id);},error:(err:unknown)=>{this.mainPrinting.set(null);this.error.set(err instanceof AppError?err.message:'PDF generation failed.');}});}

  printBatch(id: string): void {
    const reason = this.printInfo()?.history.length ? this.reprintReason().trim() : '';
    if (this.printInfo()?.history.length && reason.length < 3) {
      this.error.set('Weka sababu ya reprint yenye angalau herufi 3.');
      return;
    }
    this.printing.set(true);
    this.api.post<PrintJob>(`/agent/batches/${id}/print/`, { reprint_reason: reason || '' }, { 'Idempotency-Key': createIdempotencyKey() }).subscribe({
      next: (job) => { this.printing.set(false); this.loadPrintInfo(id); this.downloadPrint(job.id); },
      error: (err: unknown) => { this.printing.set(false); this.error.set(err instanceof AppError ? err.message : 'PDF generation failed.'); },
    });
  }

  private loadBatches():void{
    this.batchesLoading.set(true);
    this.api.get<BatchRow[]>('/agent/batches/').subscribe({
      next:(res)=>{this.batches.set(Array.isArray(res)?res:[]);this.batchPage.set(1);this.batchesLoading.set(false);for(const batch of this.mainBatches())this.loadMainPrintInfo(batch);},
      error:()=>this.batchesLoading.set(false),
    });
  }

  downloadPrint(jobId: string): void {
    this.api.download(`/agent/voucher-print-jobs/${jobId}/download/`).subscribe((blob) => this.saveBlob(blob, `bitech-vouchers-${jobId}.pdf`));
  }

  private loadPrintInfo(id: string): void {
    this.api.get<PrintInfo>(`/agent/batches/${id}/print/`).subscribe({ next: (info) => this.printInfo.set(info) });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  }
}
