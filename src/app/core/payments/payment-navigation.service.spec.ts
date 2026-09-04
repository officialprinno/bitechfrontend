import { TestBed } from '@angular/core/testing';

import { PaymentNavigationService } from './payment-navigation.service';

describe('PaymentNavigationService', () => {
  it('accepts only absolute HTTPS provider redirects', () => {
    const service = TestBed.inject(PaymentNavigationService);
    expect(service.isSafeProviderUrl('https://pay.pesapal.com/checkout/123')).toBeTrue();
    expect(service.isSafeProviderUrl('http://pay.pesapal.com/checkout/123')).toBeFalse();
    expect(service.isSafeProviderUrl('/payment/result')).toBeFalse();
    expect(service.isSafeProviderUrl(undefined)).toBeFalse();
  });
});
