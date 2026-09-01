export type PortalMode = 'captive' | 'gift_browse';

export interface PortalSite {
  id: string;
  name: string;
  slug: string;
}

export interface PortalNode {
  id: string;
  node_identifier: string;
  display_name?: string;
  health_status: string;
  is_online: boolean;
}

export type PublicGiftNode = Pick<PortalNode, 'id' | 'node_identifier' | 'display_name'>;

export interface ExpiredVoucherSummary {
  code: string;
  package_name: string;
  validity_started_at: string;
  expires_at: string;
  device_name: string;
  mac_address: string;
}

export interface PortalVoucherValidation {
  status: 'valid' | 'expired' | 'invalid';
  expired_voucher: ExpiredVoucherSummary | null;
}

export interface PortalSession {
  session_token: string;
  site: PortalSite;
  node: PortalNode;
  mac: string;
  ip: string | null;
  link_login: string;
  link_orig: string;
  hotspot_error: string;
  can_purchase_self: boolean;
  mode: PortalMode;
  voucher_status: 'expired' | null;
  expired_voucher: ExpiredVoucherSummary | null;
}

export interface PortalPackage {
  id: string;
  name: string;
  price_tzs: string;
  duration_minutes: number;
  data_limit_mb: number | null;
  speed_profile: string;
  is_active: boolean;
}

export type PurchaseType = 'self' | 'gift';
