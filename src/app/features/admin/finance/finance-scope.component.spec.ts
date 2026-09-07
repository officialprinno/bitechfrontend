import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FinanceScopeComponent } from './finance-scope.component';
import { FinanceTableComponent } from './finance-table.component';
import { FinanceParams } from './finance.service';
import { routes } from '../../../app.routes';
import { superadminGuard } from '../../../core/auth/admin-auth.guard';

describe('Finance P5 scoped reporting', () => {
  let fixture: ComponentFixture<FinanceScopeComponent>;
  let http: HttpTestingController;
  let query: BehaviorSubject<FinanceParams>;
  let params: BehaviorSubject<FinanceParams>;
  let route: {params:BehaviorSubject<FinanceParams>;queryParams:BehaviorSubject<FinanceParams>;snapshot:{data:Record<string,string>}};
  let router: Router;
  const meta={reporting_version:'v1',timezone:'Africa/Dar_es_Salaam',period:'TODAY',start:'2026-09-06T21:00:00Z',end:'2026-09-07T21:00:00Z',flow_end:'2026-09-07T09:00:00Z',as_of:'2026-09-07T09:00:00Z',captured_at:'2026-09-07T09:00:00Z',inventory_as_of:'2026-09-07T09:00:00Z'};
  beforeEach(async()=>{
    query=new BehaviorSubject<FinanceParams>({period:'today',currency:'TZS'});params=new BehaviorSubject<FinanceParams>({identity:'fixture-id'});
    route={params,queryParams:query,snapshot:{data:{financeScope:'sites'}}};
    await TestBed.configureTestingModule({imports:[FinanceScopeComponent],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),{provide:ActivatedRoute,useValue:route}]}).compileComponents();
    fixture=TestBed.createComponent(FinanceScopeComponent);http=TestBed.inject(HttpTestingController);router=TestBed.inject(Router);spyOn(router,'navigate').and.resolveTo(true);
  });
  afterEach(()=>{http.verify();fixture.destroy();});
  function render(section:unknown=[],extraMeta:Record<string,unknown>={},currency='TZS'){
    http.expectOne(r=>r.url.endsWith('/summary/')).flush({success:true,meta,data:{
      identity:{id:'fixture-id',name:'Buhongwa',is_active:false,user_active:false,current_site:{id:'site-b',name:'Current site B'},current_assignments:[{site__name:'Current site B',status:'suspended'}]},
      currencies:[{currency,direct_customer_sales:'100000.00',agent_sales:'200000.00',total_sales:'300000.00',customer_cash:'100000.00',agent_cash_allocated:'50000.00',total_attributed_cash:'150000.00',agent_outstanding:'150000.00',commercial_charges:'200000.00',cash_received:'50000.00',cash_applied:'50000.00',outstanding:'150000.00',unapplied_credit:'50000.00',charge_count:2,receipt_count:1,sites:['Historical site A']}],
      inventory:[{currency,inventory_allocated:5,ready:4,activated:1}],
      data_quality:{eligible_count:1,excluded_count:1,distinct_record_counts:{source_unknown:1,evidence_review:0,origin_unresolved:1}},legacy_unposted:{currencies:[{currency,amount:'30000.00',count:2}]},
    }});
    for(const request of http.match(()=>true)){
      expect(request.request.params.get('captured_at')).toBe(meta.captured_at);
      request.flush({success:true,meta:{...meta,...extraMeta},data:request.request.url.endsWith('/currencies/')?['TZS','USD']:section});
    }
    fixture.detectChanges();
  }
  it('renders scoped Site KPIs directly from P3 with legacy and quality disclosure',()=>{
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="status"]').getAttribute('aria-label')).toBe('Loading financial detail');render();
    const text=fixture.nativeElement.textContent;expect(text).toContain('300,000');expect(text).toContain('50,000');expect(text).toContain('Legacy Declared');expect(text).toContain('Scoped financial evidence disclosure');expect(fixture.componentInstance.totals['agent_outstanding']).toBe('150000.00');
  });
  it('separates moved Node current Site from financial origins',()=>{
    route.snapshot.data['financeScope']='nodes';fixture.detectChanges();render();
    expect(fixture.nativeElement.textContent).toContain('Current site B');expect(fixture.nativeElement.textContent).toContain('Historical site A');
  });
  it('keeps suspended Agent history readable and unapplied credit separate',()=>{
    route.snapshot.data['financeScope']='agents';fixture.detectChanges();render();
    expect(fixture.nativeElement.textContent).toContain('Suspended / disabled account');expect(fixture.nativeElement.textContent).toContain('50,000');expect(fixture.componentInstance.totals['outstanding']).toBe('150000.00');
  });
  it('renders statement opening/running/closing supplied by backend, including later pages',()=>{
    route.snapshot.data={financeScope:'agents',financeTab:'statement'};query.next({currency:'TZS',page:2});fixture.detectChanges();
    render([{id:'allocation',event_at:meta.as_of,kind:'allocation',debit_value:'0.00',credit_value:'0.00',applied_value:'25000.00',receivable_delta:'-25000.00',running_balance:'175000.00',currency_code:'TZS'}],{statement:{opening:'150000.00',movement:'25000.00',closing:'175000.00',expected_closing:'175000.00',difference:'0.00',status:'OK',currency:'TZS',count:3,statement_start:meta.start,statement_end:meta.as_of},pagination:{count:3,page:2,page_size:1,next:null}});
    expect(fixture.nativeElement.textContent).toContain('175,000');expect(fixture.componentInstance.statement?.opening).toBe('150000.00');expect(fixture.nativeElement.textContent).toContain('Ledger debit and credit are shown for context');
  });
  it('preserves custom period, currency and cutoff between Site and Node and on browser Back',()=>{
    query.next({period:'custom',start:'2026-09-01',end:'2026-09-06',currency:'USD',tab:'nodes'});fixture.detectChanges();
    render([{name:'Node X',node_id:'node-x'}],{},'USD');
    const link:HTMLAnchorElement=fixture.nativeElement.querySelector('app-finance-table a');expect(link.getAttribute('href')).toContain('/admin/finance/nodes/node-x');expect(link.getAttribute('href')).toContain('currency=USD');expect(link.getAttribute('href')).toContain('start=2026-09-01');expect(link.getAttribute('href')).toContain('captured_at=');
    query.next({period:'today',currency:'TZS'});render();expect(fixture.componentInstance.draft.period).toBe('today');expect(fixture.componentInstance.currency).toBe('TZS');
  });
  it('uses safe search/sort/page parameters and shows server totals',()=>{
    route.snapshot.data['financeScope']='agents';query.next({tab:'obligations',currency:'TZS',q:'contract',sort:'outstanding',page_size:50});fixture.detectChanges();
    render([{reference:'Contract',outstanding_amount:'150000.00'}],{detail_total:{amount:'150000.00',currency:'TZS',count:1,metric:'obligations'}});
    const c=fixture.componentInstance;c.search='receipt-safe';c.pageSize=25;c.tableFilters();
    expect(router.navigate).toHaveBeenCalledWith([],jasmine.objectContaining({queryParams:jasmine.objectContaining({q:'receipt-safe',page:1,page_size:25,sort:'outstanding'})}));
    expect(fixture.nativeElement.textContent).toContain('Total across all pages');
  });
  it('renders receipt reversal and allocation history separately',()=>{
    route.snapshot.data['financeScope']='agents';params.next({identity:'fixture-id',receiptId:'receipt-id'});fixture.detectChanges();
    render([{receipt_number:'R001',state:'REVERSED',amount:'50000.00'}],{receipt_detail:{receipt:{receipt_number:'R001',state:'REVERSED',amount:'50000.00',applied_amount:'0.00',unapplied_amount:'0.00',payment_method:'cash'},reversal:{reference:'Correction',occurred_at:meta.as_of}}});
    const text=fixture.nativeElement.textContent;expect(text).toContain('Receipt R001');expect(text).toContain('Reversal preserved');expect(text).toContain('Receipt allocations');
  });
  it('shows reconciliation expected, actual and REVIEW difference',()=>{
    query.next({tab:'reconciliation',currency:'TZS'});fixture.detectChanges();render({status:'REVIEW',checks:[{check_code:'SITE_NODE_SALES',expected:'100.00',actual:'90.00',difference:'-10.00',currency:'TZS',status:'REVIEW'}]});
    expect(fixture.nativeElement.textContent).toContain('REVIEW');expect(fixture.nativeElement.textContent).toContain('-10');expect(fixture.nativeElement.textContent).toContain('Expected');
  });
  it('handles 404, 403 and network failures without raw backend details',()=>{
    fixture.detectChanges();http.expectOne(r=>r.url.endsWith('/summary/')).flush({trace:'secret'},{status:404,statusText:'Not found'});fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('could not be found');expect(fixture.nativeElement.textContent).not.toContain('secret');
    query.next({period:'yesterday'});http.expectOne(r=>r.url.endsWith('/summary/')).flush({},{status:403,statusText:'Forbidden'});fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Superadmins only');
    query.next({period:'last_7_days'});http.expectOne(r=>r.url.endsWith('/summary/')).error(new ProgressEvent('network'));fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('could not be loaded');
  });
  it('validates custom dates and draft currency does not relabel displayed values',()=>{
    fixture.detectChanges();render();const c=fixture.componentInstance;c.draft.currency='USD';fixture.detectChanges();expect(fixture.nativeElement.querySelector('.kpi strong').textContent).toContain('TZS');
    c.draft.period='custom';c.draft.start='2026-09-07';c.draft.end='2026-09-01';c.apply();expect(c.validation).toBeTruthy();expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('P5 references and authorization',()=>{
  it('guards every new financial lazy route',()=>{
    const children=routes.find(r=>r.path==='admin')!.children!;
    for(const path of ['finance/sites/:identity','finance/nodes/:identity','finance/agents/:identity','finance/agents/:identity/statement','finance/agents/:identity/receipts/:receiptId']) expect(children.find(r=>r.path===path)!.canActivate).toContain(superadminGuard);
  });
  it('takes scoped Agent links to the account without assigning global receipts to a Site',()=>{
    TestBed.configureTestingModule({imports:[FinanceTableComponent],providers:[provideRouter([])]});
    const fixture=TestBed.createComponent(FinanceTableComponent);fixture.componentRef.setInput('columns',[]);fixture.componentRef.setInput('query',{period:'custom',start:'2026-09-01',end:'2026-09-06',currency:'TZS',site_id:'site-a',captured_at:'cutoff'});
    const query=fixture.componentInstance.entityQuery('agents');expect(query['site_id']).toBeUndefined();expect(query['return_site']).toBe('site-a');expect(query['captured_at']).toBe('cutoff');fixture.destroy();
  });
});
