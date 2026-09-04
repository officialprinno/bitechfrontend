import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { createIdempotencyKey } from '../../../core/api/idempotency-key';

interface AgentDetail { id: string; display_name: string; username?: string; agent_code: string; site_names: string[]; is_active: boolean; }
interface Assignment { site: string; site_name: string; status: string; print_permission: { enabled: boolean }; }
interface Item { line_no: number; voucher_code: string | null; voucher_password: string | null; barcode_svg: string | null; lifecycle_status: string; source: string; activation_policy: string; issued_at: string; activated_at: string | null; expires_at: string | null; sell_by_at: string | null; provisioning_status: string; }
interface Batch { id: string; issuance_request: string | null; agent_name: string; agent_code: string; site_name: string; node_identifier: string; node_display_name: string; package_name_snapshot: string; duration_minutes: number; quantity: number; created_at: string; items: Item[]; }
interface PrintJob { id: string; print_number: number; status: string; voucher_count: number; }
interface PrintInfo { eligibility: { eligible: number; excluded: number }; history: PrintJob[]; }

@Component({
  selector: 'app-admin-agent-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="space-y-5">
      <a [routerLink]="batchId() ? ['/admin/agents', agentId()] : ['/admin/agents']" class="font-semibold text-signal no-underline">← Back</a>
      @if (batch(); as b) {
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h1 class="font-display text-2xl font-bold text-ink">Batch {{ shortId(b.id) }}</h1><p class="text-sm text-[var(--text-secondary)]">{{ b.agent_name }} · {{ b.created_at | date:'medium' }}</p></div>
          <div class="w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-4"><p class="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Admin PDF actions</p><input [value]="reprintReason()" (input)="reprintReason.set($any($event.target).value)" placeholder="Reprint reason (required after first print)" class="mb-2 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-ink" /><button class="w-full rounded-xl bg-signal px-4 py-2 font-semibold text-[var(--text-inverse)]" (click)="print(b.id)">{{ printInfo()?.history?.length ? 'Regenerate / Reprint PDF' : 'Generate PDF' }}</button>@if(printInfo()?.history?.[0]; as latest){<button class="mt-2 w-full rounded-xl border border-border px-4 py-2 font-semibold text-signal" (click)="download(latest.id)">Open / Download print #{{ latest.print_number }}</button>}</div>
        </div>
        <dl class="grid gap-3 rounded-2xl border border-border bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt>Site</dt><dd>{{ b.site_name }}</dd></div><div><dt>Node</dt><dd>{{ b.node_identifier }}</dd></div>
          <div><dt>Router display</dt><dd>{{ b.node_display_name || b.node_identifier }}</dd></div><div><dt>Package</dt><dd>{{ b.package_name_snapshot }}</dd></div>
          <div><dt>Duration</dt><dd>{{ b.duration_minutes }} minutes</dd></div><div><dt>Quantity</dt><dd>{{ b.quantity }}</dd></div>
          <div><dt>Issuance request</dt><dd class="break-all font-mono text-xs">{{ b.issuance_request || 'Legacy batch' }}</dd></div>
        </dl>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="metric"><span>Total vouchers</span><strong>{{ b.quantity }}</strong></div>
          <div class="metric metric-ready"><span>Ready to print</span><strong>{{ readyCount(b) }}</strong></div>
          <div class="metric metric-pending"><span>Still processing</span><strong>{{ pendingCount(b) }}</strong></div>
        </div>
        @if (pendingCount(b)) {<div class="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"><span class="h-4 w-4 animate-spin rounded-full border-2 border-warning border-r-transparent"></span><div><strong>Vouchers are being created on the router.</strong><p class="text-[var(--text-secondary)]">This page refreshes automatically. Codes and barcodes will appear when each voucher is ready.</p></div></div>}
        @if (printInfo(); as info) { <p class="text-sm font-medium text-ink">PDF inventory: <strong>{{ info.eligibility.eligible }}</strong> ready · <strong>{{ info.history.length }}</strong> previous print{{ info.history.length === 1 ? '' : 's' }}</p> }
        <div class="grid gap-3 sm:grid-cols-2">
          @for (v of b.items; track v.line_no) {
            <article class="voucher-card" [class.voucher-pending]="!v.voucher_code">
              <div class="flex items-start justify-between gap-3">
                <div><p class="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Voucher {{ v.line_no }}</p><p class="mt-1 font-mono text-xl font-bold" [class]="v.voucher_code ? 'text-signal' : 'text-ink'">{{ v.voucher_code || 'Creating voucher…' }}</p></div>
                <span class="status-badge" [class.status-ready]="!!v.voucher_code" [class.status-pending]="!v.voucher_code">{{ v.voucher_code ? 'Ready' : 'Processing' }}</span>
              </div>
              @if(v.voucher_code){
                <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><span class="field-label">Password</span><p class="font-mono text-base font-semibold text-ink">{{ v.voucher_password }}</p></div>@if(v.barcode_svg){<img [src]="v.barcode_svg" [alt]="'Barcode for voucher ' + v.voucher_code" class="h-16 max-w-52 rounded-lg border border-border bg-white p-1" />}</div>
                <div class="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm"><div><span class="field-label">Package</span><p class="font-semibold text-ink">{{ b.package_name_snapshot }}</p></div><div><span class="field-label">Duration</span><p class="font-semibold text-ink">{{ durationLabel(b.duration_minutes) }}</p></div></div>
              } @else {
                <div class="mt-4 space-y-2"><div class="h-3 w-3/4 animate-pulse rounded bg-surface-0"></div><div class="h-3 w-1/2 animate-pulse rounded bg-surface-0"></div><p class="pt-2 text-sm text-[var(--text-secondary)]">Waiting for Router provisioning. No action is required.</p></div>
              }
              <p class="mt-4 border-t border-border pt-3 text-xs text-[var(--text-secondary)]">Issued {{ v.issued_at | date:'medium' }}<span class="mx-1">·</span>{{ v.expires_at ? ('Expires ' + (v.expires_at | date:'medium')) : 'Validity starts on first use' }}</p>
            </article>
          }
        </div>
      } @else if (agent(); as a) {
        <div><h1 class="font-display text-2xl font-bold text-ink">{{ a.display_name }}</h1><p class="text-sm text-[var(--text-secondary)]">{{ a.agent_code }} · {{ a.username || 'restricted' }} · {{ a.is_active ? 'active' : 'disabled' }}</p><p class="mt-2 text-sm font-semibold text-signal">Batches, vouchers and Admin PDF printing</p></div>
        <div class="rounded-2xl border border-border bg-surface-1 p-4"><h2 class="font-semibold text-ink">Agent PDF Self-Service</h2><p class="mt-1 text-xs text-[var(--text-secondary)]">This controls the Agent account only. Admin PDF access is always available.</p>@for(x of assignments();track x.site_name){<div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><p class="text-sm">{{ x.site_name }} · {{ x.status }} · <strong [class]="x.print_permission.enabled ? 'text-success' : 'text-warning'">{{ x.print_permission.enabled ? 'ENABLED' : 'DISABLED' }}</strong></p><button class="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-signal" (click)="setPermission(x, !x.print_permission.enabled)">{{ x.print_permission.enabled ? 'Disable Agent PDF Printing' : 'Enable Agent PDF Printing' }}</button></div>}</div>
        <div><h2 class="font-display text-lg font-semibold text-ink">Batch history</h2><p class="mt-1 text-sm text-[var(--text-secondary)]">Click a batch to view every voucher, barcode and PDF controls.</p><div class="mt-3 space-y-2">@for(b of batches();track b.id){<a [routerLink]="['/admin/agents', a.id, 'batches', b.id]" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-4 text-ink no-underline hover:border-signal"><div><strong>Batch {{ shortId(b.id) }} · {{ b.package_name_snapshot }}</strong><p class="text-sm text-[var(--text-secondary)]">{{ b.site_name }} · {{ b.node_identifier }} · {{ b.quantity }} vouchers · {{ b.created_at | date:'short' }}</p></div><span class="rounded-lg bg-signal px-3 py-2 text-xs font-semibold text-[var(--text-inverse)]">Open Batch & Print PDF →</span></a>}@empty{<p class="rounded-xl border border-border bg-surface-1 p-4 text-sm text-[var(--text-secondary)]">This agent has no batches yet.</p>}</div></div>
      }
    </section>
  `,
  styles: [`
    dt,.field-label{font-size:.7rem;color:var(--text-secondary);font-weight:700;letter-spacing:.05em;text-transform:uppercase}dd{margin-top:.25rem;color:var(--text-primary);font-weight:700}
    .metric{border:1px solid var(--border-subtle);border-radius:1rem;background:var(--surface-1);padding:1rem}.metric span{display:block;color:var(--text-secondary);font-size:.75rem;font-weight:700;text-transform:uppercase}.metric strong{display:block;margin-top:.25rem;color:var(--text-primary);font-family:var(--font-display);font-size:1.75rem}.metric-ready strong{color:var(--success)}.metric-pending strong{color:var(--warning)}
    .voucher-card{border:1px solid var(--border-subtle);border-radius:1rem;background:var(--surface-1);padding:1rem;box-shadow:var(--shadow-soft)}.voucher-pending{border-style:dashed}.status-badge{border-radius:999px;padding:.3rem .65rem;font-size:.72rem;font-weight:800}.status-ready{background:#dcfce7;color:#166534}.status-pending{background:#fef3c7;color:#92400e}
  `],
})
export class AdminAgentDetailComponent implements OnInit {
  private readonly api = inject(ApiClient); private readonly route = inject(ActivatedRoute);
  readonly agent = signal<AgentDetail | null>(null); readonly assignments = signal<Assignment[]>([]); readonly batches = signal<Batch[]>([]); readonly batch = signal<Batch | null>(null); readonly printInfo = signal<PrintInfo | null>(null);
  readonly agentId = signal(''); readonly batchId = signal('');
  readonly reprintReason = signal('');
  private refreshAttempts=0;
  ngOnInit(): void { const aid=this.route.snapshot.paramMap.get('agentId')||''; const bid=this.route.snapshot.paramMap.get('batchId')||''; this.agentId.set(aid); this.batchId.set(bid); if(bid){this.loadBatch(bid);}else{this.api.get<AgentDetail>(`/admin/agents/${aid}/`).subscribe({next:a=>this.agent.set(a)});this.api.get<Assignment[]>(`/admin/agents/${aid}/assignments/`).subscribe({next:x=>this.assignments.set(x)});this.api.get<Batch[]>(`/admin/agents/${aid}/issuances/`).subscribe({next:x=>this.batches.set(x)});} }
  shortId(id:string):string{return id.split('-')[0].toUpperCase();}
  readyCount(batch:Batch):number{return batch.items.filter(x=>!!x.voucher_code&&x.provisioning_status==='success').length;}
  pendingCount(batch:Batch):number{return batch.items.filter(x=>!x.voucher_code||x.provisioning_status==='pending').length;}
  durationLabel(minutes:number):string{return minutes%1440===0?`${minutes/1440} day${minutes===1440?'':'s'}`:minutes%60===0?`${minutes/60} hour${minutes===60?'':'s'}`:`${minutes} minutes`;}
  print(id:string):void{this.api.get<PrintInfo>(`/admin/agent-batches/${id}/print/`).subscribe({next:info=>{const reason=info.history.length?this.reprintReason().trim():'';if(info.history.length&&reason.length<3)return;this.api.post<PrintJob>(`/admin/agent-batches/${id}/print/`,{reprint_reason:reason},{'Idempotency-Key':createIdempotencyKey()}).subscribe({next:j=>this.download(j.id)});}});}
  private loadPrint(id:string):void{this.api.get<PrintInfo>(`/admin/agent-batches/${id}/print/`).subscribe({next:x=>this.printInfo.set(x)});}
  private loadBatch(id:string):void{this.api.get<Batch>(`/admin/agent-batches/${id}/`).subscribe({next:b=>{this.batch.set(b);this.loadPrint(id);const pending=b.items.some(x=>x.provisioning_status==='pending'||!x.voucher_code);if(pending&&this.refreshAttempts++<60)setTimeout(()=>this.loadBatch(id),2000);}});}
  setPermission(assignment:Assignment, enable:boolean):void{const action=enable?'grant':'revoke';this.api.post(`/admin/agents/${this.agentId()}/print-permissions/${assignment.site}/${action}/`,{}).subscribe({next:()=>this.api.get<Assignment[]>(`/admin/agents/${this.agentId()}/assignments/`).subscribe(x=>this.assignments.set(x))});}
  download(id:string):void{this.api.download(`/admin/voucher-print-jobs/${id}/download/`).subscribe(blob=>{const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);});}
}
