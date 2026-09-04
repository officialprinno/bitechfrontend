import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-full bg-surface-0">
      <div class="mx-auto flex min-h-full max-w-6xl flex-col md:flex-row">
        <aside
          class="border-b border-border bg-surface-1 px-4 py-5 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:self-start md:border-b-0 md:border-r"
        >
          <a routerLink="/admin" class="flex items-center gap-3 no-underline">
            <img src="brand/logo-mark.svg" alt="" class="h-9 w-9 rounded-xl" width="36" height="36" />
            <div>
              <p class="font-display text-sm font-bold text-ink">Bitech</p>
              <p class="text-xs text-signal">Admin</p>
            </div>
          </a>

          <nav class="mt-8 space-y-1 text-sm">
            <a
              routerLink="/admin"
              routerLinkActive="bg-signal-muted text-signal"
              [routerLinkActiveOptions]="{ exact: true }"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Dashboard
            </a>
            <a
              routerLink="/admin/sites"
              routerLinkActive="bg-signal-muted text-signal"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Sites
            </a>
            <a
              routerLink="/admin/packages"
              routerLinkActive="bg-signal-muted text-signal"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Packages
            </a>
            <a
              routerLink="/admin/nodes"
              routerLinkActive="bg-signal-muted text-signal"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Nodes
            </a>
            <a
              routerLink="/admin/support"
              routerLinkActive="bg-signal-muted text-signal"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Vouchers
            </a>
            <a routerLink="/admin/operations" routerLinkActive="bg-signal-muted text-signal" class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60">Payments & Operations</a>
              <a
                routerLink="/admin/reports"
                routerLinkActive="bg-signal-muted text-signal"
                class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
              >
                Reports & Audit
              </a>
            @if (auth.user()?.role !== 'support') {
              <a
                routerLink="/admin/agents"
                routerLinkActive="bg-signal-muted text-signal"
                class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
              >
                Agents
              </a>
              <a routerLink="/admin/agent-batches" routerLinkActive="bg-signal-muted text-signal" class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60">Agent Batches & PDF</a>
            }
          </nav>

          <a routerLink="/admin/profile" routerLinkActive="bg-signal-muted text-signal" class="mt-4 block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60">My Profile & SMS</a>

          <div class="mt-10 border-t border-border pt-4 text-xs text-[var(--text-secondary)]">
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

        <main class="flex-1 px-4 py-6 sm:px-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminShellComponent {
  constructor(readonly auth: AuthService) {}
}
