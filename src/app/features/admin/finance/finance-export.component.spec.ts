import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FinanceExportComponent } from './finance-export.component';

describe('Official finance exports',()=>{
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  function setup(scope=''){
    TestBed.configureTestingModule({imports:[FinanceExportComponent],providers:[provideHttpClient(),provideHttpClientTesting()]});
    const fixture=TestBed.createComponent(FinanceExportComponent);
    fixture.componentRef.setInput('scope',scope);
    fixture.componentRef.setInput('filters',{period:'CUSTOM',start_date:'2026-08-01',end_date:'2026-08-31',currency:'TZS',agent_id:'agent-fixture',as_of:'2026-08-31T21:00:00Z',captured_at:'2026-09-01T12:00:00Z'});
    fixture.detectChanges();return fixture;
  }
  it('preserves authoritative scope and cutoff and prevents duplicate submissions',()=>{
    const f=setup('agents');f.componentInstance.download('CSV');f.componentInstance.download('CSV');
    const req=TestBed.inject(HttpTestingController).expectOne(r=>r.url.endsWith('/exports/'));
    expect(req.request.body.report_type).toBe('AGENT_REPORT');
    expect(req.request.body.filters).toEqual(f.componentInstance.filters());
    expect(f.componentInstance.busy).toBeTrue();
    req.flush(new Blob(),{status:403,statusText:'Forbidden'});
    expect(f.componentInstance.busy).toBeFalse();expect(f.componentInstance.message).toContain('Superadmins');
  });
  it('offers statement export only in Agent scope',()=>{
    const f=setup('sites');expect(f.componentInstance.reports.some(r=>r.key==='AGENT_STATEMENT')).toBeFalse();
    f.componentRef.setInput('scope','agents');expect(f.componentInstance.reports.some(r=>r.key==='AGENT_STATEMENT')).toBeTrue();
  });
  it('downloads a server artifact and reports success',()=>{
    const f=setup();spyOn(URL,'createObjectURL').and.returnValue('blob:fixture');spyOn(HTMLAnchorElement.prototype,'click');
    f.componentInstance.download('PDF');TestBed.inject(HttpTestingController).expectOne(r=>r.url.endsWith('/exports/')).flush(new Blob(['%PDF-fixture']));
    expect(f.componentInstance.message).toContain('Download ready');expect(f.componentInstance.busy).toBeFalse();
  });
  it('shows recoverable export errors',()=>{
    const f=setup();f.componentInstance.download('XLSX');TestBed.inject(HttpTestingController).expectOne(r=>r.url.endsWith('/exports/')).flush(new Blob(),{status:400,statusText:'Bad Request'});
    expect(f.componentInstance.message).toContain('narrow');expect(f.componentInstance.busy).toBeFalse();
  });
});
