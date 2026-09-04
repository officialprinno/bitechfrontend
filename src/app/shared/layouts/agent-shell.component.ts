import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-agent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-full bg-surface-0">
      <div class="mx-auto flex min-h-full max-w-5xl flex-col md:flex-row">
        <aside
          class="border-b border-border bg-surface-1 px-4 py-5 md:min-h-screen md:w-56 md:border-b-0 md:border-r"
        >
          <a routerLink="/agent" class="flex items-center gap-3 no-underline">
            <img src="brand/logo-mark.svg" alt="" class="h-9 w-9 rounded-xl" width="36" height="36" />
            <div>
              <p class="font-display text-sm font-bold text-ink">Bitech</p>
              <p class="text-xs text-signal">Agent Portal</p>
            </div>
          </a>

          <nav class="mt-8 space-y-1 text-sm">
            <a
              routerLink="/agent"
              routerLinkActive="bg-signal-muted text-signal"
              [routerLinkActiveOptions]="{ exact: true }"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60"
            >
              Dashboard
            </a>
            <a routerLink="/agent/inventory" routerLinkActive="bg-signal-muted text-signal"
              class="block rounded-xl px-3 py-2.5 font-semibold text-[var(--text-secondary)] no-underline hover:bg-signal-muted/60">
              Vouchers zangu
            </a>
          </nav>

          <div class="mt-10 border-t border-border pt-4 text-xs text-[var(--text-secondary)]">
            <p class="font-semibold text-ink">
              {{ auth.user()?.display_name || auth.user()?.username }}
            </p>
            <p class="mt-1 font-mono">{{ auth.user()?.agent_code }}</p>
            <p class="mt-3 text-[11px] leading-relaxed">
              Vouchers hutolewa na admin. Hapa unaona codes zilizokabidhiwa.
            </p>
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
export class AgentShellComponent {
  constructor(readonly auth: AuthService) {}
}
