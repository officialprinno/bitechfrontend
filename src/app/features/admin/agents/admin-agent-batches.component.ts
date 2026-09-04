import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { createIdempotencyKey } from '../../../core/api/idempotency-key';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface BatchRow {
  id: string;
  issuance_request: string | null;
  agent: string;
  agent_name: string;
  agent_code: string;
  site_name: string;
  node_identifier: string;
  node_display_name: string;
  package_name_snapshot: string;
  duration_minutes: number;
  quantity: number;
  created_at: string;
  settlement_status: string;
}

interface BatchGroup {
  id: string;
  lines: BatchRow[];
  quantity: number;
  groupedIssuance: boolean;
}

@Component({
  selector: 'app-admin-agent-batches',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><h1 class="font-display text-2xl font-bold text-ink">{{ selectedAgentName() ? selectedAgentName() + ' Voucher Batches' : 'Agent Voucher Batches' }}</h1><p class="mt-1 text-sm text-[var(--text-secondary)]">Open a batch to view vouchers, barcodes and Admin PDF controls.</p></div>
        <a routerLink="/admin/agents" class="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-signal no-underline">Back to Agents</a>
      </div>
      @if (loading()) { <app-skeleton height="10rem" /> }
      @else if (error()) { <app-error-state title="Hitilafu" [message]="error()!" /> }
      @else {
        <div class="space-y-3">
          @for (group of groups(); track group.id) {
            <article class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
              <div class="flex flex-wrap items-start justify-between gap-4"><div><p class="font-display text-lg font-bold text-ink">Batch {{ shortId(group.id) }}</p><p class="mt-1 font-semibold text-signal">{{ group.lines[0].agent_name }}</p><p class="mt-1 text-sm text-[var(--text-secondary)]">{{ group.lines[0].site_name }} · {{ group.lines[0].node_display_name || group.lines[0].node_identifier }} · Issued {{ group.lines[0].created_at | date:'medium' }}</p></div><div class="w-full max-w-sm text-right"><p class="font-display text-2xl font-bold text-ink">{{ group.quantity }} vouchers</p>@if(printInfo()[group.id]?.history?.length){<p class="mt-1 text-xs font-semibold text-success">PDF READY · Print #{{ printInfo()[group.id].history[0].print_number }}</p><input class="mt-2 w-full rounded-xl border border-border bg-surface-0 px-3 py-2 text-sm text-ink" placeholder="Reason for reprint (required)" [ngModel]="reprintReasons()[group.id] || ''" (ngModelChange)="setReason(group.id,$event)" />}<button type="button" class="mt-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-[var(--text-inverse)] disabled:opacity-60" [disabled]="printing()===group.id" (click)="print(group)">{{ printing()===group.id ? 'Generating PDF…' : (printInfo()[group.id]?.history?.length ? 'Generate Reprint' : 'Generate Batch PDF') }}</button>@if(printErrors()[group.id]){<p class="mt-2 text-sm font-semibold text-danger">{{ printErrors()[group.id] }}</p>}</div></div>
              <div class="mt-4 grid gap-2 sm:grid-cols-3">@for(b of group.lines;track b.id){<a [routerLink]="['/admin/agents', b.agent, 'batches', b.id]" class="rounded-xl border border-border bg-surface-0 p-3 text-ink no-underline hover:border-signal"><span class="block text-xs font-bold uppercase text-[var(--text-secondary)]">Package</span><strong>{{ b.package_name_snapshot }}</strong><span class="mt-1 block text-sm text-[var(--text-secondary)]">{{ b.quantity }} vouchers · {{ duration(b.duration_minutes) }}</span><span class="mt-2 block text-xs font-semibold text-signal">View vouchers →</span></a>}</div>
            </article>
          } @empty { <div class="rounded-2xl border border-border bg-surface-1 p-8 text-center text-[var(--text-secondary)]">No agent batches found.</div> }
        </div>
      }
    </section>
  `,
})
export class AdminAgentBatchesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly batches = signal<BatchRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly printing = signal<string | null>(null);
  readonly printInfo = signal<Record<string,{history:{id:string;print_number:number}[]}>>({});
  readonly reprintReasons = signal<Record<string,string>>({});
  readonly printErrors = signal<Record<string,string>>({});
  readonly selectedAgentName = computed(() => this.batches()[0]?.agent_name || '');
  readonly groups = computed<BatchGroup[]>(() => { const map=new Map<string,BatchRow[]>(); for(const b of this.batches()){const id=b.issuance_request||b.id;map.set(id,[...(map.get(id)||[]),b]);} return [...map.entries()].map(([id,lines])=>({id,lines,quantity:lines.reduce((n,b)=>n+b.quantity,0),groupedIssuance:!!lines[0].issuance_request})); });
  ngOnInit(): void { const agentId=this.route.snapshot.queryParamMap.get('agent');const endpoint=agentId?`/admin/agent-batches/?agent=${encodeURIComponent(agentId)}`:'/admin/agent-batches/';this.api.get<BatchRow[]>(endpoint).subscribe({next:x=>{this.batches.set(Array.isArray(x)?x:[]);this.loading.set(false);for(const group of this.groups())this.loadPrintInfo(group);},error:e=>{this.error.set(e instanceof AppError?e.message:'Failed to load batches.');this.loading.set(false);}}); }
  shortId(id:string):string{return id.split('-')[0].toUpperCase();}
  duration(minutes:number):string{return minutes%1440===0?`${minutes/1440} day(s)`:minutes%60===0?`${minutes/60} hour(s)`:`${minutes} minutes`;}
  setReason(id:string,value:string):void{this.reprintReasons.update(x=>({...x,[id]:value}));}
  private printEndpoint(group:BatchGroup):string{return group.groupedIssuance?`/admin/agent-issuances/${group.id}/print/`:`/admin/agent-batches/${group.id}/print/`;}
  private loadPrintInfo(group:BatchGroup):void{this.api.get<{history:{id:string;print_number:number}[]}>(this.printEndpoint(group)).subscribe({next:x=>this.printInfo.update(all=>({...all,[group.id]:x})),error:e=>this.printErrors.update(all=>({...all,[group.id]:e instanceof AppError?e.message:'Print information could not be loaded.'}))});}
  print(group:BatchGroup):void{const id=group.id;const history=this.printInfo()[id]?.history||[];const reason=(this.reprintReasons()[id]||'').trim();if(history.length&&reason.length<3){this.printErrors.update(x=>({...x,[id]:'Enter a clear reprint reason (at least 3 characters).'}));return;}this.printErrors.update(x=>({...x,[id]:''}));this.printing.set(id);this.api.post<{id:string}>(this.printEndpoint(group),{reprint_reason:reason}, {'Idempotency-Key':createIdempotencyKey()}).subscribe({next:job=>{this.printing.set(null);this.loadPrintInfo(group);this.api.download(`/admin/voucher-print-jobs/${job.id}/download/`).subscribe(blob=>{const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);});},error:e=>{this.printing.set(null);this.printErrors.update(x=>({...x,[id]:e instanceof AppError?e.message:'PDF could not be generated.'}));}});}
}
