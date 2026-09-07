import { Routes } from '@angular/router';

import {
  adminAuthGuard,
  agentAuthGuard,
  guestAuthGuard,
  superadminGuard,
} from './core/auth/admin-auth.guard';
import { PortalShellComponent } from './shared/layouts/portal-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: PortalShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/portal/home/portal-home.component').then((m) => m.PortalHomeComponent),
        title: 'Bitech WiFi',
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./features/portal/checkout/portal-checkout.component').then(
            (m) => m.PortalCheckoutComponent,
          ),
        title: 'Malipo — Bitech WiFi',
      },
      {
        path: 'payment/result',
        loadComponent: () =>
          import('./features/portal/payment-waiting/payment-waiting.component').then(
            (m) => m.PaymentWaitingComponent,
          ),
        title: 'Matokeo ya malipo — Bitech WiFi',
      },
      {
        path: 'pay/waiting/:paymentId',
        loadComponent: () =>
          import('./features/portal/payment-waiting/payment-waiting.component').then(
            (m) => m.PaymentWaitingComponent,
          ),
        title: 'Inasubiri malipo — Bitech WiFi',
      },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./features/voucher-lookup/voucher-lookup.component').then(
            (m) => m.VoucherLookupComponent,
          ),
        title: 'Angalia voucher — Bitech WiFi',
      },
    ],
  },
  {
    path: 'login',
    canActivate: [guestAuthGuard],
    loadComponent: () =>
      import('./features/auth/unified-login.component').then((m) => m.UnifiedLoginComponent),
    title: 'Sign In — BitechWiFi',
  },
  { path: 'admin/login', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./shared/layouts/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: 'finance/details',
        canActivate: [superadminGuard],
        data: { financeDetail: true },
        loadComponent: () => import('./features/admin/finance/finance.component').then(m => m.FinanceComponent),
        title: 'Finance details — Bitech',
      },
      ...['sites', 'nodes', 'agents'].map(scope => ({
        path: `finance/${scope}/:identity`,
        canActivate: [superadminGuard], data: { financeScope: scope },
        loadComponent: () => import('./features/admin/finance/finance-scope.component').then(m => m.FinanceScopeComponent),
        title: 'Financial detail — Bitech',
      })),
      {
        path: 'finance/agents/:identity/statement', canActivate: [superadminGuard],
        data: { financeScope: 'agents', financeTab: 'statement' },
        loadComponent: () => import('./features/admin/finance/finance-scope.component').then(m => m.FinanceScopeComponent),
        title: 'Agent statement — Bitech',
      },
      {
        path: 'finance/agents/:identity/receipts/:receiptId', canActivate: [superadminGuard],
        data: { financeScope: 'agents' },
        loadComponent: () => import('./features/admin/finance/finance-scope.component').then(m => m.FinanceScopeComponent),
        title: 'Receipt detail — Bitech',
      },
      {
        path: 'finance',
        canActivate: [superadminGuard],
        loadComponent: () => import('./features/admin/finance/finance.component').then(m => m.FinanceComponent),
        title: 'Sales & finance — Bitech',
      },
      {
        path: 'nodes/health',
        loadComponent: () => import('./features/admin/nodes/admin-nodes.component').then(m => m.AdminNodesComponent),
        title: 'Router Management — Bitech',
      },
      ...[
        'agents',
        'sites',
        'nodes',
        'packages',
        'customers',
        'otp-activity',
        'sms-logs',
        'webhook-events',
        'payment-audit',
        'management-audit',
        'users',
        'agent-assignments',
        'agent-issuances',
      ].map((resource) => ({
        path: resource,
        pathMatch: 'full' as const,
        data: { resource },
        canActivate: [superadminGuard],
        loadComponent: () =>
          import('./features/admin/management/management.component').then(
            (m) => m.ManagementComponent,
          ),
        title: 'Bitech Administration',
      })),
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
        title: 'Admin — Bitech',
      },

      {
        path: 'support',
        loadComponent: () =>
          import('./features/admin/support/admin-support.component').then(
            (m) => m.AdminSupportComponent,
          ),
        title: 'Support — Admin',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/reporting/reporting-center.component').then(
            (m) => m.ReportingCenterComponent,
          ),
        title: 'Reports & Audit — Admin',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/admin/profile/admin-profile.component').then(
            (m) => m.AdminProfileComponent,
          ),
        title: 'Profile — Admin',
      },
      {
        path: 'operations',
        loadComponent: () =>
          import('./features/admin/operations/admin-operations.component').then(
            (m) => m.AdminOperationsComponent,
          ),
        title: 'Payments & Operations — Admin',
      },
      {
        path: 'agents/issue',
        loadComponent: () =>
          import('./features/admin/agents/admin-agents.component').then(
            (m) => m.AdminAgentsComponent,
          ),
        title: 'Agents — Admin',
      },
      {
        path: 'agents/:agentId',
        loadComponent: () =>
          import('./features/admin/agents/admin-agent-detail.component').then(
            (m) => m.AdminAgentDetailComponent,
          ),
        title: 'Agent Detail — Admin',
      },
      {
        path: 'agent-batches',
        loadComponent: () =>
          import('./features/admin/agents/admin-agent-batches.component').then(
            (m) => m.AdminAgentBatchesComponent,
          ),
        title: 'Agent Batches — Admin',
      },
      {
        path: 'agents/:agentId/batches/:batchId',
        loadComponent: () =>
          import('./features/admin/agents/admin-agent-detail.component').then(
            (m) => m.AdminAgentDetailComponent,
          ),
        title: 'Batch Detail — Admin',
      },
    ],
  },
  { path: 'agent/login', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'agent',
    canActivate: [agentAuthGuard],
    loadComponent: () =>
      import('./shared/layouts/agent-shell.component').then((m) => m.AgentShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/agent/dashboard/agent-dashboard.component').then(
            (m) => m.AgentDashboardComponent,
          ),
        title: 'Agent — Bitech',
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/agent/batches/agent-batches.component').then(
            (m) => m.AgentBatchesComponent,
          ),
        title: 'Vouchers — Agent',
      },
      {
        path: 'batches/:id',
        loadComponent: () =>
          import('./features/agent/batches/agent-batches.component').then(
            (m) => m.AgentBatchesComponent,
          ),
        title: 'Batch — Agent',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
