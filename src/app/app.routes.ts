import { Routes } from '@angular/router';

import {
  adminAuthGuard,
  agentAuthGuard,
  guestAdminGuard,
  guestAgentGuard,
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
          import('./features/portal/home/portal-home.component').then(
            (m) => m.PortalHomeComponent,
          ),
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
    path: 'admin/login',
    canActivate: [guestAdminGuard],
    loadComponent: () =>
      import('./features/auth/admin-login.component').then((m) => m.AdminLoginComponent),
    title: 'Admin Login — Bitech',
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./shared/layouts/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
        title: 'Admin — Bitech',
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./features/admin/sites/admin-sites.component').then(
            (m) => m.AdminSitesComponent,
          ),
        title: 'Sites — Admin',
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./features/admin/packages/admin-packages.component').then(
            (m) => m.AdminPackagesComponent,
          ),
        title: 'Packages — Admin',
      },
      {
        path: 'nodes',
        loadComponent: () =>
          import('./features/admin/nodes/admin-nodes.component').then(
            (m) => m.AdminNodesComponent,
          ),
        title: 'Nodes — Admin',
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
          import('./features/admin/reports/admin-reports.component').then(
            (m) => m.AdminReportsComponent,
          ),
        title: 'Mauzo — Admin',
      },
      {
        path: 'agents',
        loadComponent: () =>
          import('./features/admin/agents/admin-agents.component').then(
            (m) => m.AdminAgentsComponent,
          ),
        title: 'Agents — Admin',
      },
    ],
  },
  {
    path: 'agent/login',
    canActivate: [guestAgentGuard],
    loadComponent: () =>
      import('./features/auth/agent-login.component').then((m) => m.AgentLoginComponent),
    title: 'Agent Login — Bitech',
  },
  {
    path: 'agent',
    canActivate: [agentAuthGuard],
    loadComponent: () =>
      import('./shared/layouts/agent-shell.component').then((m) => m.AgentShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/agent/batches/agent-batches.component').then(
            (m) => m.AgentBatchesComponent,
          ),
        title: 'Agent — Bitech',
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
