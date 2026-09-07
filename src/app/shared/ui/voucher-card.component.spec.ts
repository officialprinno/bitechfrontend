import { VoucherDisplay, VoucherSummaryComponent, voucherState, wasUsed } from './voucher-card.component';

describe('voucher inventory presentation', () => {
  const ready: VoucherDisplay = { voucher_code: 'ab3k9m2x', provisioning_status: 'success', lifecycle_status: 'ready', is_used: false };
  it('does not label an activated or expired code as ready to use', () => {
    expect(voucherState({ ...ready, lifecycle_status: 'activated' })).toBe('active');
    expect(voucherState({ ...ready, lifecycle_status: 'expired', is_used: true })).toBe('expired');
    expect(voucherState({ ...ready, expires_at: '2020-01-01T00:00:00Z' })).toBe('expired');
    expect(voucherState({ ...ready, lifecycle_status: 'revoked', is_used: true })).toBe('revoked');
  });
  it('distinguishes unused inventory from ready inventory and excludes unissued rows', () => {
    const summary = new VoucherSummaryComponent();
    summary.items = [ready, { ...ready, is_used: true, lifecycle_status: 'activated' },
      { ...ready, is_used: true, lifecycle_status: 'expired' },
      { ...ready, lifecycle_status: 'expired' },
      { voucher_code: null, provisioning_status: 'pending' }];
    expect(summary.used).toBe(2);
    expect(summary.unused).toBe(2);
    expect(summary.ready).toBe(1);
  });
  it('recognizes device binding and handles failed provisioning explicitly', () => {
    expect(wasUsed({ ...ready, mac_address: 'AA:BB:CC:DD:EE:FF' })).toBeTrue();
    expect(voucherState({ ...ready, provisioning_status: 'failed' })).toBe('failed');
    expect(voucherState({ ...ready, voucher_code: null, provisioning_status: 'pending' })).toBe('pending');
  });
});
