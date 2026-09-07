import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Column, FinanceParams, FinanceResponse, FinanceRow, field, financeNumber } from './finance.service';

@Component({
  selector: 'app-finance-table', standalone: true, imports: [DatePipe, RouterLink],
  template: `
    <div class="table-scroll" tabindex="0" [attr.aria-label]="label() + ', scroll for more columns'">
      <table><caption class="sr-only">{{ label() }}</caption><thead><tr>
        @for (column of columns(); track column.key) { <th scope="col" [class.numeric]="column.money">{{ column.label }}</th> }
      </tr></thead><tbody>
        @for (row of response()?.data || []; track $index) {
          <tr>@for (column of columns(); track column.key; let first = $first) {
            <td [class.numeric]="column.money" [class.description]="column.key === 'description'" [class.attention]="column.key.includes('outstanding') && positive(row, column.key)">
              @if (column.link && row[column.idKey || column.key]) {
                <a [routerLink]="referenceRoute(row, column)" [queryParams]="referenceQuery(row, column)">{{ display(row, column) }}</a>
              } @else if (first && entityType() && row[identityKey()]) {
                <a [routerLink]="['/admin/finance', entityType(), row[identityKey()]]" [queryParams]="entityQuery()">{{ display(row, column) }}</a>
              } @else if (first && rowMetric() && row[identityKey()]) {
                <a routerLink="/admin/finance/details" [queryParams]="rowQuery(row)">{{ display(row, column) }}</a>
              } @else if (column.date && value(row, column.key)) {
                {{ stringValue(row, column.key) | date:'dd MMM yyyy, HH:mm':'+0300' }}
              } @else { {{ display(row, column) }} }
            </td>
          }</tr>
        } @empty { <tr><td [attr.colspan]="columns().length" class="empty">{{ emptyMessage() }}</td></tr> }
      </tbody></table>
    </div>
    @if (response()?.meta?.pagination; as p) {
      <div class="pagination"><span>{{ p.count }} records · Page {{ p.page }}</span><div>
        <button type="button" [disabled]="p.page <= 1" (click)="pageChange.emit(p.page - 1)">Previous</button>
        <button type="button" [disabled]="!p.next" (click)="pageChange.emit(p.page + 1)">Next</button>
      </div></div>
    }
  `,
  styleUrl: './finance-table.css',
})
export class FinanceTableComponent {
  readonly response = input<FinanceResponse<FinanceRow[]> | null>(null);
  readonly columns = input.required<Column[]>(); readonly label = input('Financial records');
  readonly query = input<FinanceParams>({}); readonly rowMetric = input(''); readonly identityKey = input('');
  readonly entityType = input('');
  readonly emptyMessage = input('No records match the selected filters.');
  readonly pageChange = output<number>(); readonly value = field;
  stringValue(row: FinanceRow, key: string): string { return String(field(row, key)); }
  positive(row: FinanceRow, key: string): boolean { return /^[0-9.]+$/.test(String(field(row, key))) && /[1-9]/.test(String(field(row, key))); }
  display(row: FinanceRow, column: Column): string {
    const value = field(row, column.key);
    if (column.key === 'kind') { const labels:Record<string,string>={batch_charge:'Charge',agent_payment:'Receipt',allocation:'Allocation',allocation_reversal:'Allocation reversal',reversal:'Reversal',adjustment:'Adjustment',return:'Return / credit',posted_opening:'Approved opening'}; if(labels[String(value)]) return labels[String(value)]; }
    if (column.key === 'report_kind') return value === 'direct_customer_sale' ? 'Direct customer sale' : value === 'agent_commercial_charge' ? 'Agent commercial charge' : String(value ?? '—');
    if (column.money) return financeNumber(value);
    if (Array.isArray(value)) return value.join(', ') || 'Unattributed';
    if (column.key.startsWith('inventory.')) return String(value ?? 0);
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }
  rowQuery(row: FinanceRow): FinanceParams { return { ...this.query(), metric: this.rowMetric(), [this.identityKey()]: String(row[this.identityKey()]), page: 1 }; }
  entityQuery(type = this.entityType()): FinanceParams {
    const query = { ...this.query() };
    for (const key of ['metric','tab','page','page_size','sort','q','state','customer_status','agent_id','node_id']) delete query[key];
    if (type === 'agents') { if (query['site_id']) query['return_site'] = query['site_id']; delete query['site_id']; }
    return query;
  }
  referenceRoute(row: FinanceRow, column: Column): unknown[] {
    const id = row[column.idKey || column.key];
    if (column.link === 'receipts') return ['/admin/finance/agents', row['agent_id'] || this.query()['agent_id'], 'receipts', id];
    if (column.link === 'batches') return ['/admin/agents', row['agent_id'] || this.query()['agent_id'], 'batches', id];
    if (column.link === 'payments') return ['/admin/operations'];
    return ['/admin/finance', column.link, id];
  }
  referenceQuery(row: FinanceRow, column: Column): FinanceParams {
    const query = this.entityQuery(column.link === 'receipts' ? 'agents' : column.link);
    if (column.link === 'payments') query['payment'] = String(row[column.idKey || column.key]);
    return query;
  }
}
