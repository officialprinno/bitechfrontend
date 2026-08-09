import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pb-10 pt-6 sm:px-6">
      <header class="mb-8 flex items-center justify-between gap-4">
        <a routerLink="/" class="flex items-center gap-3 no-underline">
          <img
            src="brand/logo-mark.svg"
            alt=""
            width="40"
            height="40"
            class="h-10 w-10 rounded-xl"
          />
          <div>
            <p class="font-display text-xl font-bold leading-none tracking-tight text-ink">Bitech</p>
            <p class="mt-1 text-xs font-medium text-signal">WiFi</p>
          </div>
        </a>
        <a
          routerLink="/vouchers"
          class="text-sm font-semibold text-signal no-underline hover:text-signal-hover"
        >
          Angalia voucher
        </a>
      </header>

      <main class="flex-1">
        <router-outlet />
      </main>

      <footer class="mt-10 text-center text-xs text-[var(--text-secondary)]">
        Intaneti kwa urahisi · Bitech WiFi
      </footer>
    </div>
  `,
})
export class PortalShellComponent {}
