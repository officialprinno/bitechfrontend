import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { PaymentService, PaymentStatusResponse } from '../../../core/payments/payment.service';
import { HotspotLoginService } from '../../../core/portal/hotspot-login.service';
import { PaymentWaitingComponent } from './payment-waiting.component';

describe('PaymentWaitingComponent result flow', () => {
  let fixture: ComponentFixture<PaymentWaitingComponent>;
  let responses: Subject<PaymentStatusResponse>;
  let statusSpy: jasmine.Spy;
  let recoverSpy: jasmine.Spy;
  let activePayment: ReturnType<PaymentService['getActivePayment']>;
  let resultToken: string | null;

  const response = (status: PaymentStatusResponse['status']): PaymentStatusResponse => ({
    payment_id: 'payment-1', status, provider: 'Mpesa', package_name: 'Saa 1',
    site_name: 'Bitech', failure_reason: status === 'failed' ? 'Imekataliwa' : '',
    is_terminal: status !== 'pending', delivery: null,
  });

  beforeEach(async () => {
    responses = new Subject<PaymentStatusResponse>();
    statusSpy = jasmine.createSpy('status').and.returnValue(responses);
    recoverSpy = jasmine.createSpy('recoverResult').and.returnValue(of({
      payment_id: 'payment-1', poll_token: 'recovered-poll', payment_gateway: 'pesapal',
      expires_at: '2099-01-01T00:00:00Z', status: 'success',
      display: { amount: '500.00', currency: 'TZS' },
    }));
    activePayment = { payment_id: 'payment-1', poll_token: 'poll-secret', payment_gateway: 'pesapal', expires_at: '2099-01-01T00:00:00Z' };
    resultToken = null;
    await TestBed.configureTestingModule({
      imports: [PaymentWaitingComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: {
          paramMap: { get: () => null },
          queryParamMap: { get: (key: string) => key === 'result_token' ? resultToken : 'forged-success' },
        } } },
        { provide: PaymentService, useValue: {
          getActivePayment: () => activePayment,
          storePollToken: jasmine.createSpy('storePollToken'),
          storePaymentState: jasmine.createSpy('storePaymentState'), getPollToken: () => 'poll-secret',
          getCheckoutSummary: () => null, status: statusSpy, recoverResult: recoverSpy,
        } },
        { provide: HotspotLoginService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentWaitingComponent);
  });

  it('restores protected session context and polls Bitech, ignoring callback query claims', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    expect(statusSpy).toHaveBeenCalledWith('payment-1');
    expect(fixture.componentInstance.status()).toBeNull();
    responses.next(response('pending'));
    expect(fixture.componentInstance.status()?.status).toBe('pending');
  }));

  for (const terminal of ['success', 'failed', 'expired'] as const) {
    it(`renders authoritative ${terminal.toUpperCase()} state`, fakeAsync(() => {
      fixture.detectChanges();
      tick(0);
      responses.next(response(terminal));
      fixture.detectChanges();
      expect(fixture.componentInstance.status()?.status).toBe(terminal);
      expect(fixture.nativeElement.textContent).toContain(
        terminal === 'success' ? 'Malipo yamekamilika' : terminal === 'failed' ? 'Malipo yameshindikana' : 'Muda wa malipo umeisha',
      );
    }));
  }

  it('keeps polling after a temporary status-check error', fakeAsync(() => {
    let attempt = 0;
    statusSpy.and.callFake(() => ++attempt === 1 ? throwError(() => new Error('network')) : responses);
    fixture.detectChanges();
    tick(0);
    expect(fixture.componentInstance.error()).toContain('kwa muda');
    tick(2000);
    responses.next(response('pending'));
    expect(statusSpy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.error()).toBeNull();
  }));

  it('cleans up polling when destroyed', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    const calls = statusSpy.calls.count();
    fixture.destroy();
    tick(4000);
    expect(statusSpy.calls.count()).toBe(calls);
  }));

  it('recovers with a result token when sessionStorage context is absent', fakeAsync(() => {
    activePayment = null;
    resultToken = 'opaque-result-token';
    fixture.detectChanges();
    tick(0);
    expect(recoverSpy).toHaveBeenCalledOnceWith('opaque-result-token');
    expect(statusSpy).toHaveBeenCalledWith('payment-1');
  }));

  it('shows a stable error without redirect when all recovery context is missing', fakeAsync(() => {
    activePayment = null;
    resultToken = null;
    fixture.detectChanges();
    tick(0);
    expect(statusSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('hazipatikani');
  }));

  it('shows a stable error for an invalid or expired recovery token', fakeAsync(() => {
    activePayment = null;
    resultToken = 'expired-token';
    recoverSpy.and.returnValue(throwError(() => new Error('expired')));
    fixture.detectChanges();
    tick(0);
    expect(statusSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('muda wake umeisha');
  }));
});
