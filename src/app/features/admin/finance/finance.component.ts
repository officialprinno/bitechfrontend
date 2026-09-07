import { FinanceExportComponent } from './finance-export.component';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, forkJoin, switchMap, tap } from 'rxjs';
import { FinanceTableComponent } from './finance-table.component';
import { Column, FinanceMeta, FinanceParams, FinanceResponse, FinanceRow, FinanceService, FinanceSummary, PERIODS, Reconciliation, Transactions, apiFilters, financeNumber } from './finance.service';

const money = (key: string, label: string): Column => ({ key, label, money: true });
const date = (key = 'date', label = 'Date (EAT)'): Column => ({ key, label, date: true });
const text = (key: string, label: string): Column => ({ key, label });
const stock = [text('inventory.ready', 'Ready'), text('inventory.activated', 'Activated')];
const customerColumns = [date(), text('id', 'Payment reference'), text('site_label', 'Site'), text('node_label', 'Node'), text('package_label', 'Package'), text('gateway', 'Gateway'), money('amount', 'Amount'), text('currency', 'Currency'), text('status', 'Status')];
export const DETAIL_COLUMNS: Record<string, Column[]> = {
  direct_sales: customerColumns, customer_cash: customerColumns, transactions: customerColumns,
  gross_sales: [date('financial_at'), text('report_kind', 'Source'), text('id', 'Reference'), text('site_id', 'Site origin'), text('node_origin', 'Node origin'), money('financial_amount', 'Sale'), text('currency', 'Currency')],
  cash_collected: [date(), text('kind', 'Collection source'), text('id', 'Reference'), money('value', 'Collected'), text('currency', 'Currency')],
  agent_charges: [date(), text('agent_label', 'Agent'), text('batch', 'Batch'), text('site_label', 'Site'), text('node_label', 'Node'), text('reference', 'Reference'), money('debit', 'Charge'), text('currency', 'Currency'), text('state', 'State')],
  receivables: [text('agent_label', 'Agent'), text('reference', 'Charge reference'), date(), money('debit', 'Original charge'), money('applied_amount', 'Applied'), money('outstanding_amount', 'Outstanding'), text('currency', 'Currency')],
  agent_receipts: [date('date', 'Received (EAT)'), text('agent_label', 'Agent'), text('receipt_number', 'Receipt no.'), text('payment_method', 'Method'), money('amount', 'Received'), money('applied_amount', 'Applied'), money('unapplied_amount', 'Unapplied'), text('currency', 'Currency'), text('recorded_by_name', 'Recorded by')],
};
DETAIL_COLUMNS['unapplied_credit'] = DETAIL_COLUMNS['agent_receipts'];
for (const key of ['ready', 'activated', 'provisioning_pending', 'provisioning_failed']) DETAIL_COLUMNS[key] = [date(), text('id', 'Inventory reference'), text('kind', 'Lifecycle / provisioning'), text('site_label', 'Site origin'), text('node_label', 'Node origin'), text('currency', 'Currency')];

@Component({
  selector: 'app-finance', standalone: true, imports: [DatePipe, FormsModule, RouterLink, FinanceTableComponent, FinanceExportComponent],
  providers: [FinanceService], templateUrl: './finance.component.html', styleUrl: './finance.css',
})
export class FinanceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  private readonly service = inject(FinanceService); private readonly destroy = inject(DestroyRef);
  readonly periods = PERIODS; readonly number = financeNumber;
  readonly cards = [
    { key: 'gross_sales', metric: 'gross_sales', label: 'Gross sales', help: 'Authoritative customer sales plus posted Agent commercial charges.', stock: false },
    { key: 'direct_customer_sales', metric: 'direct_sales', label: 'Direct customer sales', help: 'Customer sales eligible under the P3 financial reporting contract.', stock: false },
    { key: 'agent_sales', metric: 'agent_charges', label: 'Agent sales', help: 'Effective commercial charges. Voucher activation is not revenue.', stock: false },
    { key: 'cash_collected', metric: 'cash_collected', label: 'Cash collected', help: 'Verified customer collections plus actual Agent receipts.', stock: false },
    { key: 'outstanding', metric: 'receivables', label: 'Outstanding receivables', help: 'All effective obligations less applied receipts at the cutoff.', stock: true },
    { key: 'unapplied_credit', metric: 'unapplied_credit', label: 'Unapplied Agent credit', help: 'Receipt balances not yet allocated to obligations at the cutoff.', stock: true },
  ];
  readonly operational = [ { key: 'success', label: 'Successful payments' }, { key: 'pending', label: 'Pending payments' }, { key: 'failed', label: 'Failed payments' }, { key: 'expired', label: 'Expired payments' } ];
  readonly inventoryCards = [ { key: 'ready', label: 'Ready vouchers' }, { key: 'activated', label: 'Activated vouchers' }, { key: 'provisioning_pending', label: 'Provisioning pending' }, { key: 'provisioning_failed', label: 'Provisioning failed' } ];
  readonly performance = [
    { key: 'sites', title: 'Site performance', identity: 'site_id', metric: 'gross_sales', sort: '-total_sales', columns: [text('name', 'Site'), money('direct_customer_sales', 'Direct sales'), money('agent_sales', 'Agent sales'), money('total_sales', 'Total sales'), money('customer_cash', 'Customer cash'), money('agent_cash_allocated', 'Agent allocated cash'), money('total_attributed_cash', 'Attributed cash'), money('agent_outstanding', 'Outstanding'), ...stock] },
    { key: 'nodes', title: 'Node performance', identity: 'node_id', metric: 'gross_sales', sort: '-total_sales', columns: [text('name', 'Node'), text('sites', 'Historical sites'), money('direct_customer_sales', 'Direct sales'), money('agent_sales', 'Agent sales'), money('total_sales', 'Total sales'), money('customer_cash', 'Customer cash'), money('agent_cash_allocated', 'Agent allocated cash'), money('agent_outstanding', 'Outstanding'), text('inventory.customer_purchased_vouchers', 'Customer vouchers'), text('inventory.inventory_allocated', 'Agent issued'), ...stock] },
    { key: 'agents', title: 'Agent performance', identity: 'agent_id', metric: 'agent_charges', sort: '-commercial_charges', columns: [text('name', 'Agent'), text('sites', 'Historical sites'), money('commercial_charges', 'Commercial charges'), money('cash_received', 'Cash received'), money('cash_applied', 'Cash applied'), money('outstanding', 'Outstanding'), money('unapplied_credit', 'Unapplied credit'), text('charge_count', 'Charges'), text('receipt_count', 'Receipts'), text('inventory.inventory_allocated', 'Inventory allocated'), ...stock] },
  ];
  readonly trendColumns = [text('date', 'Day (EAT)'), money('direct_sales', 'Direct sales'), money('agent_sales', 'Agent sales'), money('gross_sales', 'Gross sales'), money('cash_collected', 'Cash collected')];
  loading = true; error = ''; validation = ''; period = 'today'; currency = 'TZS'; start = ''; end = '';
  draft = { period: 'today', currency: 'TZS', start: '', end: '' };
  query: FinanceParams = {}; pinned: FinanceParams = {}; meta: FinanceMeta | null = null;
  summary: FinanceSummary | null = null; transactions: Transactions | null = null; reconciliation: Reconciliation | null = null;
  tables: Record<string, FinanceResponse<FinanceRow[]>> = {}; details: FinanceResponse<FinanceRow[]> | null = null;
  trends: FinanceResponse<FinanceRow[]> | null = null; currencies: string[] = ['TZS']; metric = '';
  get isDetail(): boolean { return this.route.snapshot.data['financeDetail'] === true; }
  get title(): string { return this.isDetail ? (this.cards.find(c => c.metric === this.metric)?.label || (this.metric === 'transactions' ? `${this.query['customer_status'] || ''} customer payments` : this.metric.replaceAll('_', ' '))) : 'Sales & finance'; }
  get total(): FinanceRow { return this.summary?.currencies.find(r => r['currency'] === this.currency) || {}; }
  get inventory(): FinanceRow { return this.summary?.inventory.find(r => r['currency'] === this.currency) || {}; }
  get detailColumns(): Column[] { return DETAIL_COLUMNS[this.metric] || []; }
  get stockDetail(): boolean { return ['receivables', 'unapplied_credit'].includes(this.metric); }
  ngOnInit(): void {
    this.route.queryParams.pipe(
      tap(q => {
        this.query = { ...q }; this.period = String(q['period'] || 'today').toLowerCase(); this.currency = String(q['currency'] || 'TZS').toUpperCase();
        this.start = q['start'] || ''; this.end = q['end'] || ''; this.metric = q['metric'] || 'direct_sales';
        this.draft = { period: this.period, currency: this.currency, start: this.start, end: this.end };
        this.currencies = [...new Set([...this.currencies, this.currency])];
        this.loading = true; this.error = ''; this.meta = null; this.summary = null; this.details = null; this.tables = {}; this.transactions = null; this.reconciliation = null; this.trends = null;
      }),
      switchMap(() => {
        const filters = apiFilters(this.query);
        if (this.isDetail) {
          const discovery = { ...filters };
          for (const key of ['site_id', 'node_id', 'customer_status']) delete discovery[key];
          return forkJoin({
            detail: this.service.get<FinanceRow[]>(`details/${this.metric}`, { ...filters, page: this.query['page'] || 1, page_size: this.query['page_size'] || 25, sort: this.query['sort'] || 'newest' }),
            currencies: this.service.get<string[]>('currencies', discovery),
          }).pipe(tap(response => { this.details = response.detail; this.meta = response.detail.meta; this.currencies = [...new Set(['TZS', this.currency, ...response.currencies.data])]; }), catchError(e => this.failed(e)));
        }
        return this.service.get<FinanceSummary>('summary', filters).pipe(
          switchMap(summary => {
            this.summary = summary.data; this.meta = summary.meta;
            this.pinned = { ...filters, captured_at: summary.meta.captured_at, as_of: summary.meta.as_of };
            return forkJoin({
              transactions: this.service.get<Transactions>('transactions', this.pinned),
              reconciliation: this.service.get<Reconciliation>('reconciliation', this.pinned),
              currencies: this.service.get<string[]>('currencies', this.pinned),
              trends: this.service.get<FinanceRow[]>('trends', this.pinned),
              sites: this.service.get<FinanceRow[]>('sites', this.tableParams('sites')),
              nodes: this.service.get<FinanceRow[]>('nodes', this.tableParams('nodes')),
              agents: this.service.get<FinanceRow[]>('agents', this.tableParams('agents')),
            });
          }), tap(r => { this.transactions = r.transactions.data; this.reconciliation = r.reconciliation.data; this.currencies = [...new Set(['TZS', this.currency, ...r.currencies.data])]; this.trends = r.trends; this.tables = { sites: r.sites, nodes: r.nodes, agents: r.agents }; }),
          catchError(e => this.failed(e)),
        );
      }), takeUntilDestroyed(this.destroy),
    ).subscribe(() => this.loading = false);
  }
  private failed(error: { status?: number; message?: string }) {
    this.loading = false;
    this.error = error.message === 'FINANCE_CONTRACT' ? 'This reporting version is not supported. Please contact your administrator.' : error.status === 403 ? 'Finance reporting is available to Superadmins only.' : error.status === 400 ? 'The selected reporting filters are not valid. Check the dates and try again.' : 'Finance reporting could not be loaded. Please try again.';
    return EMPTY;
  }
  exportFilters(): FinanceParams { return {...apiFilters(this.query), captured_at:this.meta?.captured_at || '', as_of:this.meta?.as_of || ''}; }
  count(status: string): number { return this.transactions?.statuses.find(r => r.currency === this.currency && r.status === status)?.count || 0; }
  link(metric: string, extra: FinanceParams = {}): FinanceParams { return { ...this.query, period: this.period, currency: this.currency, captured_at: this.meta?.captured_at || '', as_of: this.meta?.as_of || '', metric, page: 1, ...extra }; }
  tableParams(key: string): FinanceParams { return { ...this.pinned, page: this.query[key + '_page'] || 1, page_size: 10, sort: this.query[key + '_sort'] || this.performance.find(p => p.key === key)!.sort }; }
  tableQuery(): FinanceParams { const q = this.link('gross_sales'); for (const key of ['sites_page', 'nodes_page', 'agents_page', 'sites_sort', 'nodes_sort', 'agents_sort']) delete q[key]; return q; }
  apply(): void {
    this.validation = '';
    if (this.draft.period === 'custom' && (!this.draft.start || !this.draft.end || this.draft.start > this.draft.end)) { this.validation = 'Choose a valid From and To date. From must be on or before To.'; return; }
    this.service.clear();
    const q: FinanceParams = { period: this.draft.period, currency: this.draft.currency };
    if (this.draft.period === 'custom') { q['start'] = this.draft.start; q['end'] = this.draft.end; }
    if (this.isDetail) for (const key of ['metric', 'site_id', 'node_id', 'agent_id', 'customer_status']) if (this.query[key]) q[key] = this.query[key];
    void this.router.navigate([], { relativeTo: this.route, queryParams: q });
  }
  reset(): void { this.service.clear(); void this.router.navigate(['/admin/finance'], { queryParams: { period: 'today', currency: 'TZS' } }); }
  refresh(): void { this.service.clear(); const q = { ...this.query }; delete q['captured_at']; delete q['as_of']; q['refresh'] = Date.now(); void this.router.navigate([], { relativeTo: this.route, queryParams: q, replaceUrl: true }); }
  page(key: string, page: number): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.query, [key]: page } }); }
  sort(key: string, value: string): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.query, [key + '_sort']: value, [key + '_page']: 1 } }); }
  detailSort(value: string): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.query, sort: value, page: 1 } }); }
}

