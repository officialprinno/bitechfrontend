import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FinanceComponent } from './finance.component';
import { FinanceParams, PERIODS, apiFilters, financeNumber } from './finance.service';
import { AuthService } from '../../../core/auth/auth.service';
import { superadminGuard } from '../../../core/auth/admin-auth.guard';
import { routes } from '../../../app.routes';

describe('Finance P4 dashboard', () => {
  let fixture: ComponentFixture<FinanceComponent>;
  let http: HttpTestingController;
  let query: BehaviorSubject<FinanceParams>;
  let router: Router;
  const meta = { reporting_version: 'v1', timezone: 'Africa/Dar_es_Salaam', period: 'TODAY', start: '2026-09-06T21:00:00Z', end: '2026-09-07T21:00:00Z', flow_end: '2026-09-07T09:00:00Z', as_of: '2026-09-07T09:00:00Z', captured_at: '2026-09-07T09:00:00Z', inventory_as_of: '2026-09-07T09:00:00Z' };
  beforeEach(async () => {
    query = new BehaviorSubject<FinanceParams>({ period: 'today', currency: 'TZS' });
    await TestBed.configureTestingModule({ imports: [FinanceComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { queryParams: query, snapshot: { data: {} } } }] }).compileComponents();
    http = TestBed.inject(HttpTestingController); router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(FinanceComponent);
  });
  afterEach(() => { http.verify(); fixture.destroy(); });
  function render(currency = 'TZS', values: Record<string, string> = {}, excluded = 0, review = false) {
    const summary = http.expectOne(r => r.url.endsWith('/finance/summary/'));
    expect(summary.request.params.get('currency')).toBe(currency);
    summary.flush({ success: true, meta, data: {
      currencies: [{ currency, direct_customer_sales: '100000.00', agent_sales: '200000.00', gross_sales: '300000.00', cash_collected: '150000.00', customer_cash: '100000.00', agent_cash_received: '50000.00', outstanding: '150000.00', unapplied_credit: '0.00', ...values }],
      inventory: [{ currency, ready: 4, activated: 1 }],
      data_quality: { eligible_count: 3, excluded_count: excluded, excluded_success_count: excluded, distinct_record_counts: { source_unknown: excluded, evidence_review: 0, origin_unresolved: excluded } },
      legacy_unposted: { currencies: [{ currency, amount: '30000.00', count: 2 }] },
    } });
    for (const request of http.match(() => true)) {
      expect(request.request.params.get('captured_at')).toBe(meta.captured_at);
      let data: unknown = [];
      if (request.request.url.endsWith('/transactions/')) data = { statuses: [{ currency, status: 'success', count: 5 }], eligible_gateways: [] };
      if (request.request.url.endsWith('/currencies/')) data = ['TZS', 'USD'];
      if (request.request.url.endsWith('/reconciliation/')) data = { status: review ? 'REVIEW' : 'OK', checks: [{ check_code: 'GROSS_SALES', currency, difference: review ? '1.00' : '0.00', status: review ? 'REVIEW' : 'OK' }], cash_attribution: [] };
      request.flush({ success: true, data, meta });
    }
    fixture.detectChanges();
  }
  it('shows loading then exact API cards, cash distinct from sales, and operational SUCCESS distinct from sales count', () => {
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Loading finance report');
    render(); const page = fixture.nativeElement.textContent;
    expect(page).toContain('300,000'); expect(page).toContain('200,000'); expect(page).toContain('150,000'); expect(page).toContain('50,000'); expect(page).toContain('3 eligible sales');
    expect(fixture.componentInstance.count('success')).toBe(5);
    expect(page).toContain('Legacy Declared'); expect(fixture.componentInstance.total['outstanding']).toBe('150000.00');
  });
  it('shows unapplied credit separately after allocation and clear outstanding', () => {
    fixture.detectChanges(); render('TZS', { agent_cash_received: '250000.00', unapplied_credit: '50000.00', outstanding: '0.00' });
    expect(fixture.componentInstance.total['unapplied_credit']).toBe('50000.00'); expect(fixture.componentInstance.total['outstanding']).toBe('0.00');
  });
  it('renders valid zeros and empty tables without stale previous values', () => {
    fixture.detectChanges(); render('TZS', { gross_sales: '0.00', direct_customer_sales: '0.00' });
    const cards = fixture.nativeElement.querySelectorAll('.kpi strong'); expect(cards[0].textContent.trim()).toBe('TZS 0'); expect(cards[1].textContent.trim()).toBe('TZS 0');
    expect(fixture.nativeElement.textContent).toContain('No records match');
  });
  it('switches currency consistently and restores URL state when going back', () => {
    fixture.detectChanges(); render(); query.next({ period: 'last_30_days', currency: 'USD' }); render('USD', { gross_sales: '52.50' });
    expect(fixture.componentInstance.currency).toBe('USD'); expect(fixture.nativeElement.querySelector('.kpi strong').textContent).toContain('USD 52.50');
    query.next({ period: 'today', currency: 'TZS' }); fixture.detectChanges(); expect(fixture.componentInstance.currency).toBe('TZS'); expect(fixture.componentInstance.period).toBe('today');
  });
  it('does not relabel existing totals when a currency is edited before Apply', () => {
    fixture.detectChanges(); render(); fixture.componentInstance.draft.currency = 'USD'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi strong').textContent).toContain('TZS 300,000');
    expect(fixture.componentInstance.currency).toBe('TZS');
  });
  it('preserves period, currency and server cutoff in semantic card links', () => {
    fixture.detectChanges(); render(); const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.kpi');
    expect(link.getAttribute('href')).toContain('/admin/finance/details'); expect(link.getAttribute('href')).toContain('metric=gross_sales'); expect(link.getAttribute('href')).toContain('captured_at=');
    for (const metric of ['direct_sales', 'agent_charges', 'cash_collected', 'receivables']) expect(fixture.componentInstance.link(metric)['as_of']).toBe(meta.as_of);
  });
  it('discloses exclusions and REVIEW differences', () => {
    fixture.detectChanges(); render('TZS', {}, 2, true); const page = fixture.nativeElement.textContent;
    expect(page).toContain('Financial evidence disclosure'); expect(page).toContain('REVIEW'); expect(page).toContain('GROSS SALES');
  });
  it('handles forbidden, network errors and incompatible contracts without raw errors', () => {
    fixture.detectChanges(); http.expectOne(r => r.url.endsWith('/summary/')).flush({}, { status: 403, statusText: 'Forbidden' }); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Superadmins only');
    query.next({ period: 'yesterday' }); http.expectOne(r => r.url.endsWith('/summary/')).error(new ProgressEvent('network')); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('could not be loaded');
    query.next({ period: 'last_7_days' }); http.expectOne(r => r.url.endsWith('/summary/')).flush({ success: true, data: {}, meta: { reporting_version: 'v2' } }); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('not supported');
  });
  it('validates custom dates and synchronizes filter changes with the router', () => {
    const c = fixture.componentInstance; c.draft.period = 'custom'; c.draft.start = '2026-09-07'; c.draft.end = '2026-09-01'; c.apply(); expect(c.validation).toBeTruthy(); expect(router.navigate).not.toHaveBeenCalled();
    c.draft.end = '2026-09-08'; c.apply(); expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { period: 'custom', currency: 'TZS', start: '2026-09-07', end: '2026-09-08' } }));
  });
  it('maps all six periods to backend contract without calculating timezone boundaries', () => {
    for (const p of PERIODS) expect(apiFilters({ period: p.key })['period']).toBe(p.key.toUpperCase());
    expect(apiFilters({ period: 'custom', start: '2026-09-01', end: '2026-09-06' })).toEqual({ period: 'CUSTOM', currency: 'TZS', start_date: '2026-09-01', end_date: '2026-09-06' });
    expect(financeNumber('9999999999999999.25')).toBe('9,999,999,999,999,999.25');
  });
  it('uses server detail total across pages rather than summing visible rows', () => {
    TestBed.inject(ActivatedRoute).snapshot.data['financeDetail'] = true;
    query.next({ metric: 'direct_sales', currency: 'TZS', period: 'today', page: 2 }); fixture.detectChanges();
    const request = http.expectOne(r => r.url.endsWith('/details/direct_sales/')); expect(request.request.params.get('page')).toBe('2');
    http.expectOne(r => r.url.endsWith('/currencies/')).flush({ success: true, data: ['TZS','USD'], meta });
    request.flush({ success: true, data: [{ id: 'reference', amount: '100.00' }], meta: { ...meta, detail_total: { amount: '100000.00', count: 50, currency: 'TZS' }, pagination: { page: 2, count: 50, page_size: 25, next: null } } }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-total').textContent).toContain('100,000'); expect(fixture.nativeElement.textContent).toContain('Total across all pages');
  });
});

describe('Finance route authorization', () => {
  it('guards both finance routes with SUPERADMIN authorization', () => {
    const children = routes.find(r => r.path === 'admin')!.children!;
    for (const path of ['finance', 'finance/details']) expect(children.find(r => r.path === path)!.canActivate).toContain(superadminGuard);
  });
  it('blocks an Agent and permits a Superadmin', () => {
    let role = 'agent'; TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: () => true, user: () => ({ role }) } }] });
    expect(TestBed.runInInjectionContext(() => superadminGuard({} as never, {} as never))).not.toBe(true);
    role = 'superadmin'; expect(TestBed.runInInjectionContext(() => superadminGuard({} as never, {} as never))).toBe(true);
  });
});
