import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { PurchaseType } from '../models/portal.model';

export interface CheckoutRequest {
  session_token: string;
  package_id: string;
  purchase_type: PurchaseType;
  phone_number: string;
  /** FR-6c: gift SMS target (optional) */
  recipient_phone?: string;
  provider?: string;
}

export interface CheckoutResponse {
  payment_id: string;
  poll_token: string;
  status: string;
  provider: string;
  amount: string;
  currency: string;
  expires_at: string;
  poll_timeout_seconds: number;
  mock_mode: boolean;
}

export interface PaymentCheckoutSummary {
  amount: string;
  currency: string;
  phone_number: string;
  purchase_type: PurchaseType;
}

export interface AutoLoginForm {
  action: string;
  method: 'POST' | 'GET';
  username_field: string;
  password_field: string;
}

export interface PaymentDeliverySms {
  enabled: boolean;
  status: 'skipped' | 'pending' | 'sent' | 'failed';
  phone: string;
  sent_at: string | null;
}

export interface PaymentDelivery {
  delivery_mode: 'auto_login' | 'show_code';
  can_auto_login: boolean;
  show_code: boolean;
  provisioning_status: 'pending' | 'success' | 'failed';
  purchase_type: PurchaseType;
  link_login: string;
  username: string | null;
  password: string | null;
  error: string | null;
  instructions: string;
  auto_login: AutoLoginForm | null;
  voucher_expires_at: string | null;
  sms?: PaymentDeliverySms | null;
}

export interface PaymentStatusResponse {
  payment_id: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
  provider: string;
  package_name: string;
  site_name: string;
  failure_reason: string;
  is_terminal: boolean;
  delivery: PaymentDelivery | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiClient);

  checkout(body: CheckoutRequest): Observable<CheckoutResponse> {
    return this.api
      .post<CheckoutResponse, CheckoutRequest>('/payments/checkout/', body)
      .pipe(
        tap((response) => {
          this.storePollToken(response.payment_id, response.poll_token);
          sessionStorage.setItem(
            this.checkoutSummaryKey(response.payment_id),
            JSON.stringify({
              amount: response.amount,
              currency: response.currency,
              phone_number: body.phone_number,
              purchase_type: body.purchase_type,
            } satisfies PaymentCheckoutSummary),
          );
        }),
      );
  }

  status(paymentId: string): Observable<PaymentStatusResponse> {
    return this.api.get<PaymentStatusResponse>(`/payments/${paymentId}/`, undefined, {
      'X-Payment-Poll-Token': this.getPollToken(paymentId) ?? '',
    });
  }

  storePollToken(paymentId: string, pollToken: string): void {
    sessionStorage.setItem(this.pollTokenKey(paymentId), pollToken);
  }

  getPollToken(paymentId: string): string | null {
    return sessionStorage.getItem(this.pollTokenKey(paymentId));
  }

  getCheckoutSummary(paymentId: string): PaymentCheckoutSummary | null {
    const raw = sessionStorage.getItem(this.checkoutSummaryKey(paymentId));
    if (!raw) return null;
    try {
      const summary = JSON.parse(raw) as PaymentCheckoutSummary;
      if (!summary.amount || !summary.currency || !summary.phone_number) return null;
      if (summary.purchase_type !== 'self' && summary.purchase_type !== 'gift') return null;
      return summary;
    } catch {
      return null;
    }
  }

  private pollTokenKey(paymentId: string): string {
    return `bitech_payment_poll_token:${paymentId}`;
  }

  private checkoutSummaryKey(paymentId: string): string {
    return `bitech_payment_checkout_summary:${paymentId}`;
  }

  detectProvider(phone: string): Observable<{ phone_number: string; provider: string }> {
    return this.api.post('/payments/detect-provider/', { phone_number: phone });
  }

  mockSuccess(paymentId: string): Observable<{ payment_id: string; status: string }> {
    return this.api.post(`/payments/${paymentId}/mock-success/`, {});
  }
}
