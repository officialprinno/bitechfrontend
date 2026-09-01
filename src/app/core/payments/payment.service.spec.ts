import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PaymentService } from './payment.service';

describe('PaymentService poll-token handling', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
    sessionStorage.clear();
  });

  afterEach(() => http.verify());

  it('stores the checkout poll token in sessionStorage', () => {
    service
      .checkout({
        session_token: 'portal-token',
        package_id: '11111111-1111-1111-1111-111111111111',
        purchase_type: 'self',
        phone_number: '0742000001',
        provider: 'Mpesa',
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/payments/checkout/'));
    request.flush({
      success: true,
      data: {
        payment_id: 'payment-1',
        poll_token: 'secret-poll-token',
        status: 'pending',
        provider: 'Mpesa',
        amount: '500.00',
        currency: 'TZS',
        expires_at: '2026-08-29T12:00:00Z',
        poll_timeout_seconds: 180,
        mock_mode: false,
      },
    });

    expect(service.getPollToken('payment-1')).toBe('secret-poll-token');
    expect(service.getCheckoutSummary('payment-1')).toEqual({
      amount: '500.00',
      currency: 'TZS',
      phone_number: '0742000001',
      purchase_type: 'self',
    });
  });

  it('restores the token from sessionStorage and sends it only in the header', () => {
    service.storePollToken('payment-2', 'restored-token');
    service.status('payment-2').subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/payments/payment-2/'));
    expect(request.request.headers.get('X-Payment-Poll-Token')).toBe('restored-token');
    expect(request.request.urlWithParams).not.toContain('restored-token');
    request.flush({
      success: true,
      data: {
        payment_id: 'payment-2',
        status: 'pending',
        provider: 'Mpesa',
        package_name: 'Saa 1',
        site_name: 'Site',
        failure_reason: '',
        is_terminal: false,
        delivery: null,
      },
    });
  });

  it('reports a missing session token without inventing a fallback', () => {
    expect(service.getPollToken('missing-payment')).toBeNull();
    expect(service.getCheckoutSummary('missing-payment')).toBeNull();
  });
});
