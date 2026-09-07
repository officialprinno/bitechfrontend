import { FinanceExportComponent } from './finance-export.component';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, combineLatest, forkJoin, of, switchMap, tap } from 'rxjs';
import { FinanceTableComponent } from './finance-table.component';
import { Column, FinanceMeta, FinanceParams, FinanceResponse, FinanceRow, FinanceService, FinanceSummary, PERIODS, apiFilters, financeNumber } from './finance.service';

interface ScopeSummary extends FinanceSummary { identity: FinanceRow }
interface ScopeCheck { check_code: string; expected: string; actual: string; difference: string; currency: string; status: string }
interface ScopeReconciliation { status: string; checks: ScopeCheck[]; unassigned_nodes?: FinanceRow[]; p3?: { status: string; checks: ScopeCheck[] }; parent?: { status: string; checks: ScopeCheck[]; unallocated_receipts?: FinanceRow[]; unassigned_sites?: FinanceRow[] } }
interface Card { key: string; label: string; tab?: string; metric?: string; stock?: boolean; inventory?: boolean; count?: boolean }
const t = (key: string, label: string, link?: Column['link'], idKey?: string): Column => ({ key, label, link, idKey });
const m = (key: string, label: string): Column => ({ key, label, money: true });
const d = (key: string, label = 'Date (EAT)'): Column => ({ key, label, date: true });
const origin = [t('site_label', 'Historical site', 'sites', 'origin_site_id'), t('node_label', 'Historical node', 'nodes', 'origin_node_id')];
const lifecycle = [t('ready','Ready'), t('activated','Activated'), t('expired','Expired'), t('revoked','Revoked'), t('provisioning_pending','Pending'), t('provisioning_failed','Failed')];
export const SCOPE_COLUMNS: Record<string, Column[]> = {
  nodes: [t('name','Node','nodes','node_id'), m('direct_customer_sales','Direct sales'), m('agent_sales','Agent sales'), m('total_sales','Total sales'), m('customer_cash','Customer cash'), m('agent_cash_allocated','Allocated cash'), m('agent_outstanding','Outstanding'), t('inventory.customer_purchased_vouchers','Customer vouchers'), t('inventory.inventory_allocated','Agent vouchers'), t('inventory.ready','Ready'), t('inventory.activated','Activated')],
  sales: [d('date'), t('id','Payment reference','payments'), t('node_label','Node','nodes','origin_node_id_snapshot'), t('package_label','Package'), t('gateway','Gateway'), m('amount','Sale'), t('currency','Currency')],
  charges: [d('date'), t('agent_label','Agent','agents','agent_id'), t('batch','Batch','batches'), ...origin, t('reference','Reference'), m('debit','Charge'), t('currency','Currency'), t('state','State')],
  agent_activity: [t('name','Agent','agents','agent_id'), m('commercial_charges','Charges'), m('cash_allocated','Allocated cash'), m('outstanding','Outstanding'), t('charge_count','Charges'), t('inventory.inventory_allocated','Allocated inventory'), t('inventory.ready','Ready'), t('inventory.activated','Activated')],
  obligations: [d('date'), t('agent_label','Agent','agents','agent_id'), t('reference','Reference'), t('agent_batch_id','Batch','batches'), ...origin, m('debit','Original charge'), m('applied_amount','Applied'), m('outstanding_amount','Outstanding'), t('state','State'), t('currency','Currency')],
  receipts: [t('receipt_number','Receipt','receipts','id'), d('date','Received (EAT)'), t('payment_method','Method'), m('amount','Original receipt'), m('applied_amount','Applied'), m('unapplied_amount','Unapplied'), t('currency','Currency'), t('recorded_by_name','Recorded by'), t('state','State')],
  allocations: [t('receipt_number','Receipt','receipts','receipt_id'), t('charge_label','Charge reference'), t('agent_label','Agent','agents','agent_id'), t('site_label','Historical site','sites','site_id'), t('node_label','Historical node','nodes','node_id'), m('amount','Allocated amount'), d('date'), t('currency','Currency'), t('state','State')],
  statement: [d('event_at'), t('kind','Event'), t('reference_label','Reference'), t('description','Description'), t('receipt_reference','Receipt','receipts'), t('batch_reference','Batch','batches'), m('debit_value','Ledger debit'), m('credit_value','Ledger credit'), m('applied_value','Application'), m('receivable_delta','Receivable change'), m('running_balance','Running receivable'), t('currency_code','Currency')],
  inventory: [t('id','Batch','batches'), t('origin_site_name_snapshot','Historical site'), t('origin_node_name_snapshot','Historical node'), t('package_name_snapshot','Package'), t('quantity','Quantity'), t('provisioned','Provisioned'), ...lifecycle],
  legacy: [t('id','Batch','batches'), d('created_at'), m('total_amount','Stored declared amount'), t('currency','Currency')],
};

@Component({
  selector: 'app-finance-scope', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, FinanceTableComponent, FinanceExportComponent], providers: [FinanceService],
  templateUrl: './finance-scope.component.html', styleUrls: ['./finance.css', './finance-scope.css'],
})
export class FinanceScopeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  private readonly finance = inject(FinanceService); private readonly destroy = inject(DestroyRef);
  readonly periods = PERIODS; readonly number = financeNumber;
  scope = 'sites'; identity = ''; receiptId = ''; tab = 'overview'; query: FinanceParams = {}; pinned: FinanceParams = {};
  summary: ScopeSummary | null = null; meta: FinanceMeta | null = null;
  table: FinanceResponse<FinanceRow[]> | null = null; reconciliation: ScopeReconciliation | null = null;
  loading = true; error = ''; validation = ''; currency = 'TZS'; currencies = ['TZS'];
  draft = { period:'today', currency:'TZS', start:'', end:'' }; search = ''; state = ''; sort = 'newest'; pageSize = 25;
  get isAgent(): boolean { return this.scope === 'agents'; }
  get name(): string { return String(this.summary?.identity['name'] || 'Finance detail'); }
  get totals(): FinanceRow { return this.summary?.currencies.find(r=>r['currency']===this.currency) || {}; }
  get inventory(): FinanceRow { return this.summary?.inventory.find(r=>r['currency']===this.currency) || {}; }
  get title(): string { return this.receiptId ? 'Receipt detail' : this.name; }
  get columns(): Column[] { return SCOPE_COLUMNS[this.receiptId ? 'allocations' : this.tab] || []; }
  get statement() { return this.table?.meta.statement; }
  get receipt() { return this.table?.meta.receipt_detail; }
  get emptyMessage(): string { return ({sales:'No customer sales for this period.',receipts:'No receipts recorded for this period.',inventory:'No voucher inventory in this scope.',statement:'No financial events within this statement period.'} as Record<string,string>)[this.tab] || 'No records match the selected filters.'; }
  get defaultSort():string{return this.tab==='statement'?'oldest':['nodes','agent_activity'].includes(this.tab)?'name':'newest';}
  get sortOptions():{key:string;label:string}[]{
    if(this.tab==='nodes')return [{key:'name',label:'Node A–Z'},{key:'sales',label:'Sales, highest first'},{key:'outstanding',label:'Outstanding, highest first'}];
    if(this.tab==='agent_activity')return [{key:'name',label:'Agent A–Z'},{key:'amount',label:'Charges, highest first'},{key:'outstanding',label:'Outstanding, highest first'}];
    const options=[{key:'newest',label:'Newest first'},{key:'oldest',label:'Oldest first'}];
    if(this.tab!=='statement')options.push({key:'amount',label:this.tab==='inventory'?'Quantity, highest first':'Amount, highest first'});
    if(this.tab==='obligations')options.push({key:'outstanding',label:'Outstanding, highest first'});
    return options;
  }
  value(row:FinanceRow,key:string):string{return String(row[key] || '');}
  get assignments(): FinanceRow[] { return (this.summary?.identity['current_assignments'] || []) as FinanceRow[]; }
  get currentSite(): FinanceRow | null { return (this.summary?.identity['current_site'] || null) as FinanceRow | null; }
  get historicalSites(): string { return ((this.totals['sites'] || []) as string[]).join(', '); }
  get tabs(): { key:string; label:string }[] {
    const tabs = [{key:'overview',label:'Overview'}];
    if (this.scope === 'sites') tabs.push({key:'nodes',label:'Nodes'});
    if (!this.isAgent) tabs.push({key:'sales',label:'Customer sales'}, {key:'agent_activity',label:'Agent activity'});
    tabs.push({key:'charges',label:'Commercial charges'}, {key:'obligations',label:'Obligations'});
    if (this.isAgent) tabs.push({key:'statement',label:'Account statement'}, {key:'receipts',label:'Receipts'});
    tabs.push({key:'allocations',label:'Allocations'}, {key:'inventory',label:'Inventory'}, {key:'reconciliation',label:'Reconciliation'});
    if (this.summary?.legacy_unposted.currencies.length) tabs.push({key:'legacy',label:'Legacy declared'});
    return tabs;
  }
  get cards(): Card[] {
    if (this.isAgent) return [
      {key:'commercial_charges',label:'Commercial charges',tab:'charges'}, {key:'cash_received',label:'Cash received',tab:'receipts'}, {key:'cash_applied',label:'Cash applied',metric:'agent_cash_allocations'},
      {key:'outstanding',label:'Outstanding receivables',tab:'obligations',stock:true}, {key:'unapplied_credit',label:'Unapplied credit',metric:'unapplied_credit',stock:true},
      {key:'charge_count',label:'Charge count',tab:'charges',count:true}, {key:'receipt_count',label:'Receipt count',tab:'receipts',count:true},
      {key:'inventory_allocated',label:'Inventory allocated',tab:'inventory',inventory:true,count:true}, {key:'ready',label:'Ready vouchers',metric:'ready',inventory:true,count:true}, {key:'activated',label:'Activated vouchers',metric:'activated',inventory:true,count:true},
    ];
    return [
      {key:'direct_customer_sales',label:'Direct customer sales',tab:'sales'}, {key:'agent_sales',label:'Agent sales',tab:'charges'}, {key:'total_sales',label:'Total sales',metric:'gross_sales'},
      {key:'customer_cash',label:'Customer cash',tab:'sales'}, {key:'agent_cash_allocated',label:'Agent allocated cash',metric:'agent_cash_allocations'},
      ...(this.scope === 'sites' ? [{key:'total_attributed_cash',label:'Total attributed cash',tab:'reconciliation'}] : []),
      {key:'agent_outstanding',label:'Agent outstanding',tab:'obligations',stock:true},
      ...(this.scope === 'nodes' ? [{key:'customer_purchased_vouchers',label:'Customer vouchers',tab:'inventory',inventory:true,count:true}, {key:'inventory_allocated',label:'Agent issued vouchers',tab:'inventory',inventory:true,count:true}] : []),
      {key:'ready',label:'Ready vouchers',metric:'ready',inventory:true,count:true}, {key:'activated',label:'Activated vouchers',metric:'activated',inventory:true,count:true},
    ];
  }
  ngOnInit(): void {
    combineLatest([this.route.params, this.route.queryParams]).pipe(
      tap(([params,q]) => {
        this.scope = this.route.snapshot.data['financeScope']; this.identity = params['identity']; this.receiptId = params['receiptId'] || '';
        this.query = {...q}; this.tab = this.receiptId ? 'allocations' : String(q['tab'] || this.route.snapshot.data['financeTab'] || 'overview');
        this.currency = String(q['currency'] || 'TZS').toUpperCase();
        this.draft = { period:String(q['period']||'today').toLowerCase(), currency:this.currency, start:String(q['start']||''), end:String(q['end']||'') };
        this.search = String(q['q']||''); this.state = String(q['state']||''); this.sort = String(q['sort'] || this.defaultSort); this.pageSize = Number(q['page_size']||25);
        this.loading = true; this.error = ''; this.table = null; this.reconciliation = null; this.summary = null; this.meta = null;
      }),
      switchMap(() => {
        const filters = this.filters();
        return this.finance.get<ScopeSummary>(`${this.scope}/${this.identity}/summary`, filters).pipe(
          switchMap(summary => {
            this.summary = summary.data; this.meta = summary.meta; this.pinned = {...filters,as_of:summary.meta.as_of,captured_at:summary.meta.captured_at};
            const discovery = {...this.pinned}; delete discovery['site_id']; delete discovery['node_id'];
            const path = this.receiptId ? `${this.scope}/${this.identity}/receipts/${this.receiptId}` : `${this.scope}/${this.identity}/${this.tab}`;
            const params: FinanceParams = {...this.pinned,page:this.query['page']||1,page_size:this.pageSize,sort:this.sort};
            if(this.search) params['q']=this.search; if(this.state) params['state']=this.state;
            return forkJoin({currencies:this.finance.get<string[]>('currencies',discovery), section:this.tab==='overview' ? of(null) : this.finance.get<FinanceRow[] | ScopeReconciliation>(path,params)});
          }), tap(result => {
            this.currencies = [...new Set(['TZS',this.currency,...result.currencies.data])];
            if(this.tab==='reconciliation') this.reconciliation = result.section?.data as ScopeReconciliation;
            else this.table = result.section as FinanceResponse<FinanceRow[]> | null;
          }), catchError(e => {this.loading=false; this.error=e.status===403?'Finance reporting is available to Superadmins only.':e.status===404?'This financial record or page could not be found.':e.status===400?'These reporting filters are not valid. Check the currency, dates, search and sort.':e.message==='FINANCE_CONTRACT'?'This reporting version is not supported.':'Finance reporting could not be loaded. Please try again.'; return EMPTY;}),
        );
      }), takeUntilDestroyed(this.destroy),
    ).subscribe(()=>this.loading=false);
  }
  filters(): FinanceParams { const filters=apiFilters(this.query); filters[this.scope.slice(0,-1)+'_id']=this.identity; return filters; }
  baseQuery(): FinanceParams {
    const q:FinanceParams={...this.query,period:this.query['period']||'today',currency:this.currency,as_of:this.meta?.as_of||'',captured_at:this.meta?.captured_at||''};
    for(const key of ['tab','page','page_size','sort','q','state','metric','refresh']) delete q[key];
    return q;
  }
  rowQuery(): FinanceParams { return {...this.baseQuery(),[this.scope.slice(0,-1)+'_id']:this.identity}; }
  overviewQuery(): FinanceParams { const q=this.baseQuery(); for(const key of ['site_id','node_id','agent_id','return_site']) delete q[key]; return q; }
  tabQuery(tab:string): FinanceParams { return {...this.baseQuery(),tab,sort:tab==='statement'?'oldest':['nodes','agent_activity'].includes(tab)?'name':'newest'}; }
  cardQuery(card:Card): FinanceParams { return card.metric ? {...this.rowQuery(),metric:card.metric} : this.tabQuery(card.tab!); }
  apply(): void {
    this.validation=''; if(this.draft.period==='custom' && (!this.draft.start || !this.draft.end || this.draft.start>this.draft.end)){this.validation='Choose a valid From and To date.';return;}
    const q:FinanceParams={...this.query,period:this.draft.period,currency:this.draft.currency,page:1};
    for(const key of ['as_of','captured_at','start','end']) delete q[key];
    if(this.draft.period==='custom'){q['start']=this.draft.start;q['end']=this.draft.end;}
    this.finance.clear();void this.router.navigate([],{relativeTo:this.route,queryParams:q});
  }
  refresh(): void { const q:FinanceParams={...this.query,refresh:Date.now()}; delete q['as_of'];delete q['captured_at'];this.finance.clear();void this.router.navigate([],{relativeTo:this.route,queryParams:q,replaceUrl:true}); }
  reset(): void {this.finance.clear();void this.router.navigate([],{relativeTo:this.route,queryParams:{period:'today',currency:'TZS'}});}
  tableFilters(): void {const q:FinanceParams={...this.baseQuery(),tab:this.tab,page:1,page_size:this.pageSize,sort:this.sort};if(this.search)q['q']=this.search;if(this.state)q['state']=this.state;void this.router.navigate([],{relativeTo:this.route,queryParams:q});}
  page(page:number):void{void this.router.navigate([],{relativeTo:this.route,queryParams:{...this.query,page}});}
}

