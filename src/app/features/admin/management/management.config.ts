export interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
}
export interface ManagementConfig {
  title: string;
  description: string;
  endpoint: string;
  columns: string[];
  statuses?: string[];
  fields?: Field[];
  detailEndpoint?: string;
  readonly?: boolean;
}
const field = (key: string, label: string, type = 'text', required = false): Field => ({
  key,
  label,
  type,
  required,
});
export const MANAGEMENT: Record<string, ManagementConfig> = {
  customers: {
    title: 'Customer history',
    description: 'Purchase history and fulfilment references. Customer numbers are masked.',
    endpoint: '/admin/diagnostics/customers/',
    columns: ['phone', 'total_purchases', 'total_spent', 'last_purchase_at'],
    readonly: true,
  },
  'otp-activity': {
    title: 'Verification activity',
    description: 'Read-only verification diagnostics. Verification codes are never displayed.',
    endpoint: '/admin/diagnostics/otp-activity/',
    columns: ['phone', 'purpose', 'status', 'attempt_count', 'created_at', 'expires_at'],
    statuses: ['unused', 'consumed', 'expired'],
    readonly: true,
  },
  'sms-logs': {
    title: 'SMS delivery',
    description: 'Track delivery status without exposing message bodies or verification codes.',
    endpoint: '/admin/diagnostics/sms-logs/',
    columns: [
      'phone',
      'category',
      'provider',
      'status',
      'attempt_count',
      'created_at',
      'sent_at',
      'failure_summary',
    ],
    statuses: ['pending', 'sent', 'delivered', 'failed', 'skipped'],
    readonly: true,
  },
  'webhook-events': {
    title: 'Webhook events',
    description: 'Gateway receipt and processing history. Raw provider payloads remain restricted.',
    endpoint: '/admin/diagnostics/webhook-events/',
    columns: [
      'provider',
      'status',
      'payment_id',
      'created_at',
      'processed_at',
      'duplicate_status',
      'failure_summary',
    ],
    statuses: ['received', 'processing', 'processed', 'failed'],
    readonly: true,
  },
  'payment-audit': {
    title: 'Payment audit',
    description: 'Read-only payment transitions and request references.',
    endpoint: '/admin/diagnostics/payment-audit/',
    columns: [
      'payment_id',
      'event_type',
      'previous_status',
      'status',
      'source',
      'created_at',
      'request_id',
    ],
    readonly: true,
  },
  'management-audit': {
    title: 'Management history',
    description: 'Who changed an account or operating record, when, and why.',
    endpoint: '/admin/diagnostics/management-audit/',
    columns: ['created_at', 'actor_id', 'action', 'object_id', 'reason', 'request_id'],
    readonly: true,
  },
  users: {
    title: 'Account access',
    description:
      'Account state and secure password actions. Agent access is managed through the agent lifecycle.',
    endpoint: '/admin/diagnostics/users/',
    columns: ['username', 'name', 'account_type', 'status', 'created_at', 'last_login'],
    statuses: ['active', 'suspended', 'disabled'],
  },
  'agent-assignments': {
    title: 'Agent assignments',
    description: 'Manage site access while preserving historical assignment episodes.',
    endpoint: '/admin/agent-assignments/',
    columns: ['agent_name', 'site_name', 'status', 'assigned_at', 'suspended_at', 'ended_at'],
    statuses: ['active', 'suspended', 'ended'],
  },
  'agent-issuances': {
    title: 'Issuance requests',
    description: 'Track requested inventory and open the original batch and print workflow.',
    endpoint: '/admin/agent-issuances/',
    columns: ['agent', 'site', 'requested_by', 'requested_quantity', 'status', 'created_at'],
    statuses: ['provisioning', 'completed', 'partially_failed', 'failed'],
  },
  agents: {
    title: 'Agents',
    description: 'Accounts, site access and voucher inventory in one place.',
    endpoint: '/admin/agents/',
    columns: [
      'display_name',
      'account_status',
      'inventory_count',
      'last_login',
    ],
    statuses: ['active', 'suspended', 'disabled'],
    fields: [
      field('display_name', 'Agent name', 'text', true),
      field('phone_number', 'Phone'),
      field('username', 'Username', 'text', true),
      field('password', 'Initial password', 'password', true),
      field('site_ids', 'Initial site', 'site', true),
    ],
  },
  sites: {
    title: 'Sites',
    description: 'Business locations and their network availability.',
    endpoint: '/admin/sites/',
    columns: ['name', 'region', 'is_active', 'created_at', 'updated_at'],
    statuses: ['active', 'inactive'],
    fields: [
      field('name', 'Site name', 'text', true),
      field('slug', 'Unique site code', 'text', true),
      field('region', 'Region'),
      field('is_active', 'Active', 'checkbox'),
    ],
  },
  nodes: {
    title: 'Nodes',
    description: 'Router availability and safe network configuration.',
    endpoint: '/admin/nodes/',
    columns: [
      'display_name',
      'node_identifier',
      'site_name',
      'health_status',
      'is_active',
      'last_health_check_at',
    ],
    statuses: ['online', 'offline', 'unknown'],
    fields: [
      field('display_name', 'Display name'),
      field('node_identifier', 'Identifier', 'text', true),
      field('site', 'Site', 'site', true),
      field('mikrotik_host', 'Router host', 'text', true),
      field('api_username', 'API username', 'text', true),
      field('api_password', 'New API password', 'password'),
      field('api_port', 'API port', 'number'),
      field('use_ssl', 'Use TLS', 'checkbox'),
      field('is_active', 'Active', 'checkbox'),
    ],
  },
  packages: {
    title: 'Packages',
    description:
      'Pricing, validity and availability. Existing catalog validation remains authoritative.',
    endpoint: '/admin/packages/',
    columns: ['name', 'price_tzs', 'duration_minutes', 'site_name', 'node_identifier', 'is_active'],
    statuses: ['active', 'inactive'],
    fields: [
      field('name', 'Package name', 'text', true),
      field('site', 'Site', 'site', true),
      field('node', 'Node (optional)', 'node'),
      field('price_tzs', 'Price (TZS)', 'number', true),
      field('duration_minutes', 'Duration (minutes)', 'number', true),
      field('speed_profile', 'Speed profile'),
      field('data_limit_mb', 'Data limit (MB, optional)', 'number'),
      field('mikrotik_profile_name', 'Router profile name'),
      field('mikrotik_limit_uptime', 'Router uptime limit'),
      field('sort_order', 'Display order', 'number'),
      field('is_active', 'Active', 'checkbox'),
    ],
  },
};
