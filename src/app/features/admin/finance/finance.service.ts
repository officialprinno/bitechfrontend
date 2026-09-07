import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type FinanceRow = Record<string, unknown>;
export type FinanceParams = Record<string, string | number>;
export interface FinanceMeta {
  reporting_version: string; timezone: string; period: string; start: string; end: string;
  flow_end: string; as_of: string; captured_at: string; inventory_as_of: string;
  pagination?: { count: number; page: number; page_size: number; next: string | null };
  detail_total?: { metric: string; amount: string | null; count: number; currency: string };
  statement?: { opening: string; movement: string; closing: string; expected_closing: string; difference: string; status: string; currency: string; count: number; statement_start: string; statement_end: string };
  receipt_detail?: { receipt: FinanceRow; reversal: FinanceRow | null };
}
export interface FinanceResponse<T> { success: boolean; data: T; meta: FinanceMeta }
export interface FinanceSummary {
  currencies: FinanceRow[]; inventory: FinanceRow[];
  data_quality: { eligible_count: number; excluded_count: number; excluded_success_count: number; distinct_record_counts: Record<string, number> };
  legacy_unposted: { currencies: FinanceRow[] };
}
export interface Transactions { statuses: { currency: string; status: string; count: number }[]; eligible_gateways: FinanceRow[] }
export interface Reconciliation { status: 'OK' | 'REVIEW'; checks: { check_code: string; currency: string; difference: string; status: string }[]; cash_attribution: FinanceRow[] }
export interface Column { key: string; label: string; money?: boolean; date?: boolean; link?: 'sites' | 'nodes' | 'agents' | 'receipts' | 'batches' | 'payments'; idKey?: string }

export const PERIODS = [
  { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: 'Last 7 days' }, { key: 'this_month', label: 'This month' },
  { key: 'last_30_days', label: 'Last 30 days' }, { key: 'custom', label: 'Custom' },
];
export function apiFilters(query: FinanceParams): FinanceParams {
  const result: FinanceParams = { period: String(query['period'] || 'today').toUpperCase(), currency: String(query['currency'] || 'TZS').toUpperCase() };
  if (result['period'] === 'CUSTOM') {
    result['start_date'] = query['start'] || ''; result['end_date'] = query['end'] || '';
  }
  for (const key of ['as_of', 'captured_at', 'site_id', 'node_id', 'agent_id', 'customer_status']) {
    if (query[key]) result[key] = query[key];
  }
  return result;
}
// Format decimal strings without converting financial values to floating point.
export function financeNumber(value: unknown): string {
  const raw = String(value ?? '0');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return '—';
  const [whole, fraction = ''] = raw.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction && /[1-9]/.test(fraction) ? '.' + fraction : '');
}
export function field(row: FinanceRow, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as FinanceRow)[part] : undefined, row);
}

@Injectable()
export class FinanceService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<FinanceResponse<unknown>>>();
  clear(): void { this.cache.clear(); }
  get<T>(resource: string, query: FinanceParams): Observable<FinanceResponse<T>> {
    const key = resource + JSON.stringify(Object.entries(query).sort());
    const cached = this.cache.get(key);
    if (cached) return cached as Observable<FinanceResponse<T>>;
    const params = new HttpParams({ fromObject: query });
    const result = this.http.get<FinanceResponse<T>>(`${environment.apiBaseUrl.replace(/\/$/, '')}/admin/finance/${resource}/`, { params }).pipe(
      map(response => {
        if (!response.success || response.meta?.reporting_version !== 'v1') throw new Error('FINANCE_CONTRACT');
        return response;
      }), shareReplay({ bufferSize: 1, refCount: true }),
    );
    if (this.cache.size >= 40) this.cache.clear();
    this.cache.set(key, result);
    return result;
  }
}
