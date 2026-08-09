import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../api/api-client';

export interface LookupVoucherItem {
  id: string;
  username: string | null;
  purchase_type: 'self' | 'gift';
  package_name: string;
  site_name: string;
  node_identifier: string;
  status: string;
  is_used: boolean;
  is_mac_bound: boolean;
  mac_address: string;
  bound_device_name: string;
  purchased_at: string | null;
  expires_at: string | null;
  provisioning_status: string;
}

export interface PhoneLookupResult {
  mine: LookupVoucherItem[];
  gifted: LookupVoucherItem[];
  customer: {
    phone_number: string;
    total_purchases: number;
    total_spent: string;
    last_purchase_at: string | null;
  };
}

export interface MacLookupResult {
  mac_address: string;
  vouchers: LookupVoucherItem[];
  mine: LookupVoucherItem[];
  gifted_on_device: LookupVoucherItem[];
}

@Injectable({ providedIn: 'root' })
export class VoucherLookupService {
  private readonly api = inject(ApiClient);

  byMac(sessionToken: string): Observable<MacLookupResult> {
    return this.api.get<MacLookupResult>(
      `/vouchers/by-mac/?session_token=${encodeURIComponent(sessionToken)}`,
    );
  }

  requestOtp(phone_number: string): Observable<{
    phone_number: string;
    expires_in_seconds: number;
    resend_after_seconds: number;
    mock_mode: boolean;
    debug_otp?: string;
  }> {
    return this.api.post('/vouchers/lookup/otp/request/', { phone_number });
  }

  verifyOtp(phone_number: string, otp: string): Observable<{
    lookup_token: string;
    phone_number: string;
    expires_in_seconds: number;
  }> {
    return this.api.post('/vouchers/lookup/otp/verify/', { phone_number, otp });
  }

  mine(lookupToken: string): Observable<PhoneLookupResult> {
    return this.api.get<PhoneLookupResult>(
      `/vouchers/mine/?lookup_token=${encodeURIComponent(lookupToken)}`,
    );
  }
}
