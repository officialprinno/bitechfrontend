import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-full bg-surface-0">
      <div class="mx-auto flex min-h-full max-w-[1600px] flex-col md:flex-row">
        <aside
          class="border-b border-border bg-surface-1 px-4 py-5 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:w-64 md:shrink-0 md:self-start md:border-b-0 md:border-r"
        >
          <a routerLink="/admin" class="flex items-center gap-3 no-underline">
            <img
              src="brand/logo-mark.svg"
              alt=""
              class="h-9 w-9 rounded-xl"
              width="36"
              height="36"
            />
            <div>
              <p class="font-display text-sm font-bold text-ink">Bitech</p>
              <p class="text-xs text-signal">Admin</p>
            </div>
          </a>

          <button type="button" class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold md:hidden"
            aria-controls="admin-navigation" [attr.aria-expanded]="mobileMenuOpen()"
            (click)="mobileMenuOpen.set(!mobileMenuOpen())">{{ mobileMenuOpen() ? 'Close navigation' : 'Open navigation' }}</button>
          <nav id="admin-navigation" class="mt-7 space-y-6 text-sm md:block" [class.hidden]="!mobileMenuOpen()" aria-label="Administration">
            @for (group of groups; track group.title) {
              <div>
                <p
                  class="mb-3 rounded-r-lg border-l-4 border-signal bg-signal-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink"
                >
                  {{ group.title }}
                </p>
                @for (link of group.links; track link.path) {
                  @if (link.path !== '/admin/finance' || auth.user()?.role === 'superadmin') {
                  <a
                    [routerLink]="link.path"
                    (click)="mobileMenuOpen.set(false)"
                    routerLinkActive="bg-signal-muted text-signal"
                    [routerLinkActiveOptions]="{ exact: link.path === '/admin' }"
                    class="block rounded-lg px-3 py-2 font-medium text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
                    >{{ link.label }}</a
                  >
                  }
                }
              </div>
            }
          </nav>

          <a
            routerLink="/admin/profile"
            [class.hidden]="!mobileMenuOpen()"
            routerLinkActive="bg-signal-muted text-signal"
            class="mt-4 block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60 md:block"
            >My Profile & SMS</a
          >

          <div class="mt-10 border-t border-border pt-4 text-xs text-[var(--text-secondary)] md:block" [class.hidden]="!mobileMenuOpen()">
            <p class="font-semibold text-ink">{{ auth.user()?.username }}</p>
            <p class="mt-1 capitalize">{{ auth.user()?.role?.replace('_', ' ') }}</p>
            <button
              type="button"
              class="mt-3 text-sm font-semibold text-signal hover:text-signal-hover"
              (click)="auth.logout()"
            >
              Toka
            </button>
          </div>
        </aside>

        <main class="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  readonly mobileMenuOpen = signal(false);
  readonly groups = [
    { title: 'Overview', links: [{ label: 'Dashboard', path: '/admin' }, { label: 'Finance', path: '/admin/finance' }] },
    {
      title: 'Business',
      links: [
        { label: 'Agents', path: '/admin/agents' },
        { label: 'Assignments', path: '/admin/agent-assignments' },
        { label: 'Issuance requests', path: '/admin/agent-issuances' },
        { label: 'Batches & PDF', path: '/admin/agent-batches' },
        { label: 'Voucher inventory', path: '/admin/support' },
        { label: 'Customers', path: '/admin/customers' },
      ],
    },
    {
      title: 'Network & catalog',
      links: [
        { label: 'Sites', path: '/admin/sites' },
        { label: 'Nodes', path: '/admin/nodes' },
        { label: 'Router access', path: '/admin/nodes/health' },
        { label: 'Packages', path: '/admin/packages' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { label: 'Payments & recovery', path: '/admin/operations' },
        { label: 'Payment audit', path: '/admin/payment-audit' },
        { label: 'Webhook events', path: '/admin/webhook-events' },
        { label: 'SMS delivery', path: '/admin/sms-logs' },
        { label: 'Verification activity', path: '/admin/otp-activity' },
        { label: 'Reports', path: '/admin/reports' },
      ],
    },
    {
      title: 'Administration',
      links: [
        { label: 'Account access', path: '/admin/users' },
        { label: 'Management history', path: '/admin/management-audit' },
      ],
    },
  ];
  constructor(readonly auth: AuthService) {}
}
