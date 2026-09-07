import { Component, inject, input } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { FinanceParams } from './finance.service';

@Component({
  selector: 'app-finance-export', standalone: true, imports: [FormsModule],
  template: `<section aria-label="Official financial exports">
    <label>Report <select [ngModel]="selected || reports[0].key" (ngModelChange)="selected=$event" [disabled]="busy">@for(option of reports; track option.key){<option [value]="option.key">{{option.label}}</option>}</select></label>
    <div class="buttons">@for(format of ['CSV','XLSX','PDF'];track format){<button type="button" [disabled]="busy" (click)="download(format)">{{busy ? 'Preparing…' : 'Export ' + (format==='XLSX' ? 'Excel' : format)}}</button>}</div>
    <button type="button" (click)="loadHistory()">Export history</button>
    <p role="status">{{message || 'Uses the displayed period, currency and reporting cutoff. Exports include all report rows, independent of table pagination.'}}</p>
    @if(history.length){<ul>@for(item of history;track item['id']){<li>{{item['report_type']}} · {{item['format']}} · {{item['status']}} · {{item['generated_at']}}</li>}</ul>}
  </section>`,
  styles: [`section{display:flex;align-items:end;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #d7e2e7;padding:16px;border-radius:14px}label{display:grid;gap:6px;font-size:.85rem;font-weight:600}select,button{font:inherit;padding:10px 14px;border:1px solid #bdd2d9;border-radius:8px;background:white;min-height:44px}button{color:#086e72;cursor:pointer;font-weight:600}button:disabled{opacity:.55;cursor:wait}.buttons{display:flex;gap:8px;flex-wrap:wrap}p{flex-basis:100%;font-size:.8rem;color:#536773;margin:0}:focus-visible{outline:3px solid #14a9b4;outline-offset:2px}`],
})
export class FinanceExportComponent {
  readonly filters = input.required<FinanceParams>();
  readonly scope = input('');
  private readonly http = inject(HttpClient);
  selected = ''; busy = false; message = '';
  history:Record<string,unknown>[]=[];
  loadHistory():void{this.http.get<{data:Record<string,unknown>[]}>(`${environment.apiBaseUrl.replace(/\/$/,'')}/admin/finance/exports/history/`).subscribe({next:r=>this.history=r.data,error:()=>this.message='Export history could not be loaded.'});}
  get reports(): {key:string;label:string}[] {
    const main = this.scope()==='agents' ? [{key:'AGENT_REPORT',label:'Agent financial report'},{key:'AGENT_STATEMENT',label:'Agent statement'},{key:'AGENT_RECEIPTS',label:'Agent receipts'}] : this.scope()==='sites' ? [{key:'SITE_REPORT',label:'Site financial report'}] : this.scope()==='nodes' ? [{key:'NODE_REPORT',label:'Node financial report'}] : [{key:'FINANCE_SUMMARY',label:'Finance summary'},{key:'AGENT_RECEIPTS',label:'Agent receipts'}];
    const options = [...main, {key:'DIRECT_CUSTOMER_SALES',label:'Direct customer sales'}, {key:'AGENT_SALES',label:'Agent commercial sales'}, {key:'CASH_COLLECTIONS',label:'Cash collections'}, {key:'AGENT_RECEIVABLES',label:'Agent receivables'}, {key:'VOUCHER_INVENTORY',label:'Voucher inventory'}, {key:'RECONCILIATION',label:'Reconciliation'}, {key:'DATA_QUALITY',label:'Data quality'}];
    return options;
  }
  download(format:string):void {
    if(this.busy)return;
    this.busy=true;this.message='Preparing your report…';
    const reportType=this.selected || this.reports[0].key;
    this.http.post(`${environment.apiBaseUrl.replace(/\/$/,'')}/admin/finance/exports/`, {report_type:reportType,format,filters:this.filters()}, {observe:'response',responseType:'blob'}).subscribe({
      next:response=>{
        if(response.body){const url=URL.createObjectURL(response.body);const link=document.createElement('a');link.href=url;link.download=`bitech-${reportType.toLowerCase().replaceAll('_','-')}-${this.filters()['currency']}.${format.toLowerCase()}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
        this.busy=false;this.message='Download ready. Check the reconciliation status included in your report.';
      },
      error:async(error:HttpErrorResponse)=>{this.busy=false;this.message=error.status===403?'Only Superadmins can export financial reports.':'Report could not be prepared. Check the filters or narrow the period and try again.';},
    });
  }
}
