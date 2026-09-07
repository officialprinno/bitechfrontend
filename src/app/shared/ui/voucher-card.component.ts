import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface VoucherDisplay {
  voucher_code: string | null;
  voucher_password?: string | null;
  barcode_svg?: string | null;
  provisioning_status: string;
  lifecycle_status?: string;
  is_used?: boolean;
  activated_at?: string | null;
  expires_at?: string | null;
  mac_address?: string;
  device_name?: string;
}

export function wasUsed(v: VoucherDisplay): boolean {
  return !!(v.is_used || v.activated_at || v.mac_address || v.lifecycle_status === 'activated');
}
export function voucherState(v: VoucherDisplay): string {
  if (v.lifecycle_status === 'revoked') return 'revoked';
  if (v.provisioning_status === 'failed' || v.lifecycle_status === 'provisioning_failed') return 'failed';
  if (v.lifecycle_status === 'expired' || (v.expires_at && Date.parse(v.expires_at) <= Date.now())) return 'expired';
  if (!v.voucher_code || v.provisioning_status === 'pending') return 'pending';
  if (wasUsed(v)) return 'active';
  return v.lifecycle_status === 'ready' || v.provisioning_status === 'success' ? 'ready' : 'unknown';
}

@Component({
  selector: 'app-voucher-card', standalone: true, imports: [DatePipe],
  template: `
    <article class="card" [attr.data-state]="state">
      <header><span class="eyebrow">VOUCHER · {{ number }}</span><span class="badge">{{ labels[state] }}</span></header>
      <h3>{{ voucher.voucher_code || 'Inaandaliwa…' }}</h3>
      <p class="package">{{ packageName }}</p>
      <div class="identity">
        <div><span class="label">Matumizi</span><strong>{{ used ? 'Imetumika' : voucher.voucher_code ? 'Haijatumika' : 'Bado haijatolewa' }}</strong>
        @if(voucher.voucher_password && voucher.voucher_password !== voucher.voucher_code){<span class="label">Password</span><strong>{{ voucher.voucher_password }}</strong>}</div>
        @if(voucher.barcode_svg){<img [src]="voucher.barcode_svg" [alt]="'Barcode ya voucher ' + voucher.voucher_code" />}
      </div>
      <dl><div><dt>Kifaa</dt><dd>{{ voucher.device_name || (used ? 'Jina halijapatikana' : 'Hakijaunganishwa') }}</dd></div>
      <div><dt>MAC address</dt><dd class="mono">{{ voucher.mac_address || '—' }}</dd></div></dl>
      <footer>
        @if(voucher.activated_at){<p><span>Ilianza</span><time>{{ voucher.activated_at | date:'d MMM y, HH:mm':'+0300' }}</time></p>}
        @if(voucher.expires_at){<p><span>{{ state === 'expired' ? 'Iliisha' : 'Inaisha' }}</span><time>{{ voucher.expires_at | date:'d MMM y, HH:mm':'+0300' }}</time></p>}
        @else if(state === 'ready'){<p>Muda unaanza voucher itakapotumika.</p>}
        @if(state === 'active'){<p>Imeanzishwa; hii si taarifa ya kifaa kuwa online.</p>}
      </footer>
    </article>`,
  styles: [`
    :host{display:block;height:100%;min-width:0}.card{height:100%;border:1px solid var(--border-subtle);border-top:3px solid #94a3b8;border-radius:18px;background:var(--surface-1);padding:22px;color:var(--text-primary);box-shadow:0 3px 12px #0f172a05}
    header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.eyebrow,.label,dt{font-size:0.875rem;font-weight:600;letter-spacing:.04em;color:var(--text-secondary)}.badge{font-size:0.875rem;font-weight:700;padding:5px 10px;border-radius:999px;background:#f1f5f9;color:#475569}h3{font-family:var(--font-mono);font-size:25px;font-weight:700;letter-spacing:.06em;margin:18px 0 4px;overflow-wrap:anywhere}.package{font-size:1rem;color:var(--text-secondary)}.identity{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 0}.label,strong{display:block}strong{font-size:1rem;margin-top:4px}img{width:140px;max-width:50%;height:65px;object-fit:contain;background:white;border:1px solid #e2e8f0;border-radius:8px;padding:5px}dl{display:grid;grid-template-columns:1fr 1fr;gap:14px;border-top:1px solid var(--border-subtle);padding-top:16px}dd{font-size:0.9375rem;margin-top:5px;overflow-wrap:anywhere}.mono{font-family:var(--font-mono)}footer{border-top:1px solid var(--border-subtle);margin-top:16px;padding-top:12px;font-size:0.875rem;color:var(--text-secondary)}footer p{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:4px}
    [data-state=ready]{border-top-color:#0d9488}[data-state=ready] .badge{background:#ccfbf1;color:#115e59}[data-state=active]{border-top-color:#2563eb}[data-state=active] .badge{background:#dbeafe;color:#1e40af}[data-state=expired] .badge{background:#fef3c7;color:#92400e}[data-state=failed] .badge,[data-state=revoked] .badge{background:#fee2e2;color:#991b1b}
  `],
})
export class VoucherCardComponent {
  @Input({ required: true }) voucher!: VoucherDisplay;
  @Input() packageName = '';
  @Input() number = 1;
  get state() { return voucherState(this.voucher); }
  get used() { return wasUsed(this.voucher); }
  readonly labels: Record<string, string> = { ready: 'Tayari kutumika', active: 'Inatumika', expired: 'Imeisha muda', pending: 'Inaandaliwa', failed: 'Imeshindikana', revoked: 'Imefutwa', unknown: 'Hali haijathibitishwa' };
}

@Component({
  selector: 'app-voucher-summary', standalone: true,
  template: `<div class="summary" aria-label="Muhtasari wa voucher za batch hii">
    <div><span>Total vouchers</span><strong>{{ items.length }}</strong><small>Katika batch hii</small></div>
    <div><span>Total used</span><strong>{{ used }}</strong><small>Zilizowahi kutumika</small></div>
    <div><span>Total unused</span><strong>{{ unused }}</strong><small>Zimetolewa, hazijatumika</small></div>
    <div><span>Tayari kutumika</span><strong>{{ ready }}</strong><small>Zinapatikana kwa matumizi</small></div>
    </div>`,
  styles: [`.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.summary>div{padding:20px;border:1px solid var(--border-subtle);border-radius:16px;background:var(--surface-1)}span,small{display:block;color:var(--text-secondary);font-size:0.9375rem}span{font-weight:600}strong{display:block;font-size:30px;font-weight:700;color:var(--text-primary);margin:8px 0}small{font-size:0.875rem}@media(max-width:700px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}`],
})
export class VoucherSummaryComponent {
  @Input() items: VoucherDisplay[] = [];
  get used() { return this.items.filter(wasUsed).length; }
  get unused() { return this.items.filter(v => !!v.voucher_code && !wasUsed(v)).length; }
  get ready() { return this.items.filter(v => voucherState(v) === 'ready').length; }
}
