import {
  VoucherCardComponent,
  VoucherSummaryComponent,
} from '../../../shared/ui/voucher-card.component';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { createIdempotencyKey } from '../../../core/api/idempotency-key';

interface AgentDetail {
  id: string;
  display_name: string;
  username?: string;
  agent_code: string;
  site_names: string[];
  is_active: boolean;
  account_status: string;
  active_assignments: number;
  batches_count: number;
  inventory_count: number;
  phone_number: string;
  last_login: string | null;
}
interface Assignment {
  site: string;
  site_name: string;
  status: string;
  print_permission: { enabled: boolean };
}
interface Item {
  is_used?: boolean;
  mac_address?: string;
  device_name?: string;
  line_no: number;
  voucher_code: string | null;
  voucher_password: string | null;
  barcode_svg: string | null;
  lifecycle_status: string;
  source: string;
  activation_policy: string;
  issued_at: string;
  activated_at: string | null;
  expires_at: string | null;
  sell_by_at: string | null;
  provisioning_status: string;
}
interface Batch {
  id: string;
  issuance_request: string | null;
  agent_name: string;
  agent_code: string;
  site_name: string;
  node_identifier: string;
  node_display_name: string;
  package_name_snapshot: string;
  duration_minutes: number;
  quantity: number;
  created_at: string;
  items: Item[];
}
interface MainBatch { id:string;site:string;requested_quantity:number;created_at:string;status:string; }
interface PrintJob {
  id: string;
  print_number: number;
  status: string;
  voucher_count: number;
}
interface PrintInfo {
  eligibility: { eligible: number; excluded: number };
  history: PrintJob[];
}

@Component({
  selector: 'app-admin-agent-detail',
  standalone: true,
  imports: [VoucherCardComponent, VoucherSummaryComponent, RouterLink, DatePipe],
  template: `
    <section class="space-y-5">
      @if(permissionError()){<p role="alert" class="rounded-xl border border-danger p-4 text-danger">{{ permissionError() }}</p>}
      @if(pendingPermission();as pending){<section class="rounded-2xl border border-border bg-surface-1 p-5 space-y-3"><h2 class="font-display font-semibold">Confirm {{ pending.enable ? 'enable' : 'disable' }} PDF printing</h2><p class="text-sm">{{ pending.assignment.site_name }}</p><label class="block text-sm">Reason<input class="mt-2 block w-full rounded-xl border border-border p-3" [value]="permissionReason()" (input)="permissionReason.set($any($event.target).value)" maxlength="255" /></label><div class="flex gap-4"><button class="rounded-xl bg-signal px-4 py-2 text-white" [disabled]="!permissionReason().trim() || permissionSaving()" (click)="confirmPermission()">Confirm change</button><button (click)="pendingPermission.set(null)">Cancel</button></div></section>}
      <a
        [routerLink]="batchId() ? ['/admin/agents', agentId()] : ['/admin/agents']"
        class="font-semibold text-signal no-underline"
        >← Back</a
      >
      @if (batch(); as b) {
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="font-display text-2xl font-bold text-ink">Batch {{ shortId(b.id) }}</h1>
            <p class="text-sm text-[var(--text-secondary)]">
              {{ b.agent_name }} · {{ b.created_at | date: 'medium' }}
            </p>
          </div>
          <div class="w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-4">
            <p class="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              Admin PDF actions
            </p>
            <input
              [value]="reprintReason()"
              (input)="reprintReason.set($any($event.target).value)"
              placeholder="Reprint reason (required after first print)"
              class="mb-2 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-ink"
            /><button
              class="w-full rounded-xl bg-signal px-4 py-2 font-semibold text-[var(--text-inverse)]"
              (click)="print(b.id)"
            >
              {{ printInfo()?.history?.length ? 'Regenerate / Reprint PDF' : 'Generate PDF' }}
            </button>
            @if (printInfo()?.history?.[0]; as latest) {
              <button
                class="mt-2 w-full rounded-xl border border-border px-4 py-2 font-semibold text-signal"
                (click)="download(latest.id)"
              >
                Open / Download print #{{ latest.print_number }}
              </button>
            }
          </div>
        </div>
        <dl
          class="grid gap-3 rounded-2xl border border-border bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <dt>Site</dt>
            <dd>{{ b.site_name }}</dd>
          </div>
          <div>
            <dt>Node</dt>
            <dd>{{ b.node_identifier }}</dd>
          </div>
          <div>
            <dt>Router display</dt>
            <dd>{{ b.node_display_name || b.node_identifier }}</dd>
          </div>
          <div>
            <dt>Package</dt>
            <dd>{{ b.package_name_snapshot }}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{{ b.duration_minutes }} minutes</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{{ b.quantity }}</dd>
          </div>
          <div>
            <dt>Issuance request</dt>
            <dd class="break-all font-mono text-xs">{{ b.issuance_request || 'Legacy batch' }}</dd>
          </div>
        </dl>
        <app-voucher-summary [items]="b.items" />
        @if (pendingCount(b)) {
          <div
            class="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
          >
            <span
              class="h-4 w-4 animate-spin rounded-full border-2 border-warning border-r-transparent"
            ></span>
            <div>
              <strong>Vouchers are being created on the router.</strong>
              <p class="text-[var(--text-secondary)]">
                This page refreshes automatically. Codes and barcodes will appear when each voucher
                is ready.
              </p>
            </div>
          </div>
        }
        @if (printInfo(); as info) {
          <p class="text-sm font-medium text-ink">
            PDF inventory: <strong>{{ info.eligibility.eligible }}</strong> ready ·
            <strong>{{ info.history.length }}</strong> previous print{{
              info.history.length === 1 ? '' : 's'
            }}
          </p>
        }
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          @for (v of b.items; track v.line_no) {
            <app-voucher-card
              [voucher]="v"
              [number]="v.line_no"
              [packageName]="b.package_name_snapshot"
            />
          }
        </div>
      } @else if (agent(); as a) {
        <nav
          class="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-1 p-3 text-xs"
          aria-label="Agent management sections"
        >
          <a
            class="rounded-lg bg-signal-muted px-3 py-2 font-semibold text-signal"
            [routerLink]="['/admin/agents', a.id]"
            >Overview & batches</a
          >
          <a
            class="px-3 py-2 text-signal"
            routerLink="/admin/agents"
            [queryParams]="{ agent: a.id }"
            >Account access</a
          >
          <a
            class="px-3 py-2 text-signal"
            routerLink="/admin/agent-assignments"
            [queryParams]="{ agent: a.id }"
            >Assignments</a
          >
          <a
            class="px-3 py-2 text-signal"
            routerLink="/admin/agent-issuances"
            [queryParams]="{ agent: a.id }"
            >Issuance requests</a
          >
          <a
            class="px-3 py-2 text-signal"
            routerLink="/admin/reports"
            [queryParams]="{ kind: 'inventory', agent: a.id, scope: 'all' }"
            >Voucher inventory</a
          >
          <a
            class="px-3 py-2 text-signal"
            routerLink="/admin/management-audit"
            [queryParams]="{ object: a.id }"
            >Account history</a
          >
        </nav>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="metric">
            <span>Account status</span><strong>{{ a.account_status }}</strong>
          </div>
          <div class="metric">
            <span>Active assignments</span><strong>{{ a.active_assignments }}</strong>
          </div>
          <div class="metric">
            <span>Voucher inventory</span><strong>{{ a.inventory_count }}</strong>
          </div>
        </div>
        <p class="text-sm text-[var(--text-secondary)]">
          {{ a.phone_number || 'No phone recorded' }} · Last login
          {{ a.last_login ? (a.last_login | date: 'medium') : 'Never' }}
        </p>
        <div>
          <h1 class="font-display text-2xl font-bold text-ink">{{ a.display_name }}</h1>
          <p class="text-sm text-[var(--text-secondary)]">
            {{ a.agent_code }} · {{ a.username || 'restricted' }} ·
            {{ a.is_active ? 'active' : 'disabled' }}
          </p>
          <p class="mt-2 text-sm font-semibold text-signal">
            Batches, vouchers and Admin PDF printing
          </p>
        </div>
        <div class="rounded-2xl border border-border bg-surface-1 p-4">
          <h2 class="font-semibold text-ink">Agent PDF Self-Service</h2>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">
            This controls the Agent account only. Admin PDF access is always available.
          </p>
          @for (x of assignments(); track x.site_name) {
            <div
              class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <p class="text-sm">
                {{ x.site_name }} · {{ x.status }} ·
                <strong [class]="x.print_permission.enabled ? 'text-success' : 'text-warning'">{{
                  x.print_permission.enabled ? 'ENABLED' : 'DISABLED'
                }}</strong>
              </p>
              <button
                class="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-signal"
                (click)="setPermission(x, !x.print_permission.enabled)"
              >
                {{
                  x.print_permission.enabled
                    ? 'Disable Agent PDF Printing'
                    : 'Enable Agent PDF Printing'
                }}
              </button>
            </div>
          }
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Main batches</h2>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">Open a main batch to view its package batches, vouchers and PDF history.</p>
          <nav aria-label="Main batch pages" class="flex flex-wrap items-center gap-4 py-3 text-sm"><span>{{ batchCount() }} main batches · Page {{ batchPage() }}</span><button [disabled]="batchPage()<=1" (click)="moveBatches(-1)">Previous</button><button [disabled]="!batchNext()" (click)="moveBatches(1)">Next</button></nav>
          @if(batchError()){<p role="alert" class="text-danger">{{ batchError() }}</p>}
          <div class="mt-3 space-y-3">
            @for(main of mainBatches();track main.id){
              <details class="rounded-2xl border border-border bg-surface-1" (toggle)="loadMainBatch(main.id,$event)">
                <summary class="cursor-pointer p-5 text-ink"><span class="font-semibold">Main batch {{ shortId(main.id) }}</span><span class="ml-3 text-xs text-[var(--text-secondary)]">{{ main.created_at | date:'medium' }}</span><span class="mt-2 block text-sm text-[var(--text-secondary)]">{{ main.site }} · {{ main.requested_quantity }} vouchers · {{ main.status.replaceAll('_',' ') }}</span></summary>
                <div class="border-t border-border p-5"><h3 class="mb-3 font-semibold">Batch history</h3>
                  @if(mainBatchItems()[main.id];as children){
                    @for(b of children;track b.id){<a [routerLink]="['/admin/agents',a.id,'batches',b.id]" class="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-ink no-underline hover:border-signal"><div><strong>{{ b.package_name_snapshot }}</strong><p class="text-xs text-[var(--text-secondary)]">Batch {{ shortId(b.id) }} · {{ b.quantity }} vouchers · {{ b.node_identifier }}</p></div><span class="text-sm font-semibold text-signal">Open vouchers & PDF →</span></a>}
                    @empty{<p class="text-sm">No package batches recorded.</p>}
                  }@else{<p class="text-sm">{{ batchError() ? 'Unable to load. Close and reopen to retry.' : 'Loading batch history…' }}</p>}
                </div>
              </details>
            }@empty{<p class="rounded-xl border border-border bg-surface-1 p-4">No main batches recorded for this agent.</p>}
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      dt,
      .field-label {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      dd {
        margin-top: 0.25rem;
        color: var(--text-primary);
        font-weight: 700;
      }
      .metric {
        border: 1px solid var(--border-subtle);
        border-radius: 1rem;
        background: var(--surface-1);
        padding: 1rem;
      }
      .metric span {
        display: block;
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .metric strong {
        display: block;
        margin-top: 0.25rem;
        color: var(--text-primary);
        font-family: var(--font-display);
        font-size: 1.75rem;
      }
      .metric-ready strong {
        color: var(--success);
      }
      .metric-pending strong {
        color: var(--warning);
      }
      .voucher-card {
        border: 1px solid var(--border-subtle);
        border-radius: 1rem;
        background: var(--surface-1);
        padding: 1rem;
        box-shadow: var(--shadow-soft);
      }
      .voucher-pending {
        border-style: dashed;
      }
      .status-badge {
        border-radius: 999px;
        padding: 0.3rem 0.65rem;
        font-size: 0.875rem;
        font-weight: 800;
      }
      .status-ready {
        background: #dcfce7;
        color: #166534;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
    `,
  ],
})
export class AdminAgentDetailComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly batchPage = signal(1);
  readonly batchCount = signal(0);
  readonly batchNext = signal(false);
  readonly pendingPermission = signal<{assignment:Assignment;enable:boolean}|null>(null);
  readonly permissionReason = signal('');
  readonly permissionSaving = signal(false);
  readonly permissionError = signal('');
  readonly agent = signal<AgentDetail | null>(null);
  readonly assignments = signal<Assignment[]>([]);
  readonly mainBatches = signal<MainBatch[]>([]);
  readonly mainBatchItems = signal<Record<string,Batch[]>>({});
  readonly batchError = signal('');
  private readonly loadingMainBatches = new Set<string>();
  readonly batch = signal<Batch | null>(null);
  readonly printInfo = signal<PrintInfo | null>(null);
  readonly agentId = signal('');
  readonly batchId = signal('');
  readonly reprintReason = signal('');
  private refreshAttempts = 0;
  ngOnInit(): void {
    const aid = this.route.snapshot.paramMap.get('agentId') || '';
    const bid = this.route.snapshot.paramMap.get('batchId') || '';
    this.agentId.set(aid);
    this.batchId.set(bid);
    if (bid) {
      this.loadBatch(bid);
    } else {
      this.api
        .get<AgentDetail>(`/admin/agents/${aid}/`)
        .subscribe({ next: (a) => this.agent.set(a) });
      this.api
        .get<Assignment[]>(`/admin/agents/${aid}/assignments/`)
        .subscribe({ next: (x) => this.assignments.set(x) });
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params=>{
        this.batchPage.set(Math.max(1,Number(params.get('batch_page'))||1));
        this.batchError.set('');
        this.api.getPage<MainBatch>('/admin/agent-issuances/',{agent:aid,page:this.batchPage(),page_size:25}).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:x=>{this.mainBatches.set(x.rows);this.batchCount.set(x.count);this.batchNext.set(x.next);},error:e=>this.batchError.set(e.message||'Unable to load main batches.')});
      });
    }
  }
  shortId(id: string): string {
    return id.split('-')[0].toUpperCase();
  }
  loadMainBatch(id:string,event:Event):void{
    if(!(event.target as HTMLDetailsElement).open || this.mainBatchItems()[id] || this.loadingMainBatches.has(id))return;
    this.loadingMainBatches.add(id);this.batchError.set('');
    this.api.get<{batches:Batch[]}>(`/admin/agent-issuances/${id}/`).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{this.mainBatchItems.update(items=>({...items,[id]:data.batches}));this.loadingMainBatches.delete(id);},error:e=>{this.loadingMainBatches.delete(id);this.batchError.set(e.message||'Unable to load batch history.');}});
  }
  moveBatches(delta:number):void{this.router.navigate([],{relativeTo:this.route,queryParams:{batch_page:this.batchPage()+delta},queryParamsHandling:'merge'});}
  readyCount(batch: Batch): number {
    return batch.items.filter((x) => !!x.voucher_code && x.provisioning_status === 'success')
      .length;
  }
  pendingCount(batch: Batch): number {
    return batch.items.filter((x) => !x.voucher_code || x.provisioning_status === 'pending').length;
  }
  durationLabel(minutes: number): string {
    return minutes % 1440 === 0
      ? `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`
      : minutes % 60 === 0
        ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
        : `${minutes} minutes`;
  }
  print(id: string): void {
    this.api.get<PrintInfo>(`/admin/agent-batches/${id}/print/`).subscribe({
      next: (info) => {
        const reason = info.history.length ? this.reprintReason().trim() : '';
        if (info.history.length && reason.length < 3) return;
        this.api
          .post<PrintJob>(
            `/admin/agent-batches/${id}/print/`,
            { reprint_reason: reason },
            { 'Idempotency-Key': createIdempotencyKey() },
          )
          .subscribe({ next: (j) => this.download(j.id) });
      },
    });
  }
  private loadPrint(id: string): void {
    this.api
      .get<PrintInfo>(`/admin/agent-batches/${id}/print/`)
      .subscribe({ next: (x) => this.printInfo.set(x) });
  }
  private loadBatch(id: string): void {
    this.api.get<Batch>(`/admin/agent-batches/${id}/`).subscribe({
      next: (b) => {
        this.batch.set(b);
        this.loadPrint(id);
        const pending = b.items.some((x) => x.provisioning_status === 'pending' || !x.voucher_code);
        if (pending && this.refreshAttempts++ < 60) setTimeout(() => this.loadBatch(id), 2000);
      },
    });
  }
  setPermission(assignment: Assignment, enable: boolean): void {
    this.pendingPermission.set({assignment,enable});this.permissionReason.set('');this.permissionError.set('');
  }
  confirmPermission():void {
    const pending=this.pendingPermission();if(!pending||!this.permissionReason().trim()||this.permissionSaving())return;
    const {assignment,enable}=pending;this.permissionSaving.set(true);
    const action = enable ? 'grant' : 'revoke';
    this.api
      .post(`/admin/agents/${this.agentId()}/print-permissions/${assignment.site}/${action}/`, {reason:this.permissionReason().trim()})
      .subscribe({
        next: () => {
          this.permissionSaving.set(false);this.pendingPermission.set(null);
          this.api
            .get<Assignment[]>(`/admin/agents/${this.agentId()}/assignments/`)
            .subscribe((x) => this.assignments.set(x));},
        error:e=>{this.permissionSaving.set(false);this.permissionError.set(e.message||'Unable to change print permission.');},
      });
  }
  download(id: string): void {
    this.api.download(`/admin/voucher-print-jobs/${id}/download/`).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
}
