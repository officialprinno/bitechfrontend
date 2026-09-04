import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';

type ReportRow = Record<string, unknown>;

@Component({
  selector: 'app-reporting-center', standalone: true, imports: [FormsModule, RouterLink],
  template: `
    <section class="space-y-5">
      <div><h1 class="font-display text-2xl font-bold text-ink">Reports & Audit</h1><p class="mt-1 text-sm text-[var(--text-secondary)]">Scoped, read-only records and bounded exports</p></div>
      <div class="flex flex-wrap gap-2">@for(t of tabs(); track t){<button class="rounded-xl px-3 py-2 text-xs font-semibold" [class]="kind() === t ? 'bg-signal text-[var(--text-inverse)]' : 'bg-surface-2 text-[var(--text-secondary)]'" (click)="select(t)">{{ t }}</button>}</div>
      @if (activeFilter()) {<div class="flex flex-wrap items-center gap-3 rounded-xl border border-signal/30 bg-signal-muted px-4 py-2 text-sm">Filter: <strong>{{ activeFilter() }}</strong><a routerLink="/admin/reports" [queryParams]="{kind:kind(),range:range()}" class="text-signal underline">Clear filter</a></div>}
      <div class="grid gap-2 rounded-2xl border border-border bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-5"><label class="text-xs lg:col-span-2">Search<input type="search" [(ngModel)]="search" (keyup.enter)="applyFilters()" placeholder="Search reference, agent, voucher, site, status..." class="mt-1 block w-full rounded-lg border border-border bg-surface-0 p-2 text-ink"></label><label class="text-xs">From<input type="date" [(ngModel)]="from" class="mt-1 block w-full rounded-lg border border-border bg-surface-0 p-2"></label><label class="text-xs">To<input type="date" [(ngModel)]="to" class="mt-1 block w-full rounded-lg border border-border bg-surface-0 p-2"></label><label class="text-xs">Sort<select [(ngModel)]="sort" class="mt-1 block w-full rounded-lg border border-border bg-surface-0 p-2"><option value="-created_at">Newest</option><option value="created_at">Oldest</option></select></label><div class="flex items-end gap-2 lg:col-span-5"><button class="rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-[var(--text-inverse)]" (click)="applyFilters()">Apply</button>@if(search){<button class="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink" (click)="clearSearch()">Clear search</button>}@if(canExport && kind() !== 'audit'){<button class="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-signal" (click)="exportCsv()">CSV</button>}</div></div>
      <div class="overflow-x-auto rounded-2xl border border-border bg-surface-1"><table class="w-full min-w-[55rem] text-left text-xs"><thead>@if(rows()[0]; as first){<tr class="border-b border-border">@for(k of keys(first); track k){<th class="p-3 uppercase text-[var(--text-secondary)]">{{ k }}</th>}</tr>}</thead><tbody>@for(r of rows(); track $index){<tr class="border-b border-border/70">@for(k of keys(r); track k){<td class="max-w-64 truncate p-3">{{ display(r[k]) }}</td>}</tr>}</tbody></table></div>
      <div class="flex justify-end gap-2"><button class="rounded-lg border border-border px-3 py-2 text-sm" [disabled]="page() === 1" (click)="move(-1)">Previous</button><span class="p-2 text-sm">Page {{ page() }}</span><button class="rounded-lg border border-border px-3 py-2 text-sm" [disabled]="rows().length < 25" (click)="move(1)">Next</button></div>
    </section>`,
})
export class ReportingCenterComponent implements OnInit {
  private readonly api = inject(ApiClient); private readonly auth = inject(AuthService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  readonly kind = signal('payments'); readonly rows = signal<ReportRow[]>([]); readonly page = signal(1); readonly tabs = signal<string[]>([]);
  readonly lifecycle = signal(''); readonly status = signal(''); readonly range = signal(''); readonly scope = signal('');
  from = ''; to = ''; sort = '-created_at'; search = '';
  activeFilter(): string { return [this.lifecycle() && `lifecycle=${this.lifecycle()}`, this.status() && `status=${this.status()}`, this.range() && `range=${this.range()}`].filter(Boolean).join(' · '); }
  get canExport(): boolean { return this.auth.user()?.role !== 'support'; }
  ngOnInit(): void { const support = this.auth.user()?.role === 'support'; this.tabs.set(support ? ['provisioning','revocations','audit'] : ['payments','issuance','inventory','assignments','provisioning','revocations','prints','settlements','audit']); this.route.queryParamMap.subscribe(p => { const requested=p.get('kind') || this.tabs()[0]; this.kind.set(this.tabs().includes(requested) ? requested : this.tabs()[0]); this.lifecycle.set(p.get('lifecycle') || ''); this.status.set(p.get('status') || ''); this.range.set(p.get('range') || ''); this.scope.set(p.get('scope') || ''); this.load(); }); }
  select(kind: string): void { this.router.navigate(['/admin/reports'], {queryParams:{kind}}); }
  applyFilters():void{this.page.set(1);this.load();}
  clearSearch():void{this.search='';this.applyFilters();}
  load(): void { const path = this.kind() === 'audit' ? '/admin/reports/audit/' : `/admin/reports/${this.kind()}/`; this.api.get<ReportRow[]>(path, { search:this.search.trim(), from: this.from, to: this.to, sort: this.sort, page: this.page(), page_size: 25, lifecycle:this.lifecycle(), status:this.status(), range:this.range(), scope:this.scope() }).subscribe(x => this.rows.set(x)); }
  move(delta: number): void { this.page.update(x => x + delta); this.load(); }
  keys(row: ReportRow): string[] { return Object.keys(row); }
  display(value: unknown): string { return value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''); }
  exportCsv(): void { const query = new URLSearchParams(); if(this.search.trim()) query.set('search',this.search.trim()); if(this.from) query.set('from', this.from); if(this.to) query.set('to', this.to); query.set('sort', this.sort); this.api.download(`/admin/reports/${this.kind()}/export/?${query}`).subscribe(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bitech-${this.kind()}-report.csv`; a.click(); URL.revokeObjectURL(url); }); }
}
