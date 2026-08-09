import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
  external_id: string;
  status: string;
  provider: string;
  amount: string;
  currency: string;
  expires_at: string;
  poll_timeout_seconds: number;
  mock_mode: boolean;
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
  external_id: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
  provider: string;
  amount: string;
  currency: string;
  purchase_type: PurchaseType;
  phone_number: string;
  package_name: string;
  site_name: string;
  failure_reason: string;
  expires_at: string;
  is_terminal: boolean;
  delivery: PaymentDelivery | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiClient);

  checkout(body: CheckoutRequest): Observable<CheckoutResponse> {
    return this.api.post<CheckoutResponse, CheckoutRequest>('/payments/checkout/', body);
  }

  status(paymentId: string): Observable<PaymentStatusResponse> {
    return this.api.get<PaymentStatusResponse>(`/payments/${paymentId}/`);
  }

  detectProvider(phone: string): Observable<{ phone_number: string; provider: string }> {
    return this.api.post('/payments/detect-provider/', { phone_number: phone });
  }

  mockSuccess(paymentId: string): Observable<{ payment_id: string; status: string }> {
    return this.api.post(`/payments/${paymentId}/mock-success/`, {});
  }
}
