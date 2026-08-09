import { Component } from '@angular/core';

import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-voucher-lookup-placeholder',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state
      title="Angalia voucher zangu"
      message="Kipengele hiki kitafunguliwa Milestone M7 (OTP + MAC lookup)."
    />
  `,
})
export class VoucherLookupPlaceholderComponent {}
