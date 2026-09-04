import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/app-error';

interface NotificationPhone {
  id: string;
  display_phone_number: string;
  is_active: boolean;
  is_primary: boolean;
}

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Admin Profile</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ auth.user()?.username }} · private notification settings</p>
      </div>
      <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
        <h2 class="font-display text-lg font-semibold text-ink">SMS notification numbers</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">Administrative alerts are delivered independently to every active number.</p>
        <form class="mt-4 flex flex-col gap-2 sm:flex-row" (ngSubmit)="add()">
          <input name="phone" [(ngModel)]="phone" placeholder="0742... or +255742..." class="min-h-11 flex-1 rounded-xl border border-border bg-surface-0 px-3 text-ink" />
          <button type="submit" [disabled]="saving()" class="rounded-xl bg-signal px-4 py-2 font-semibold text-[var(--text-inverse)] disabled:opacity-60">Add number</button>
        </form>
        @if (message()) { <p class="mt-3 text-sm text-warning">{{ message() }}</p> }
        <ul class="mt-4 divide-y divide-border">
          @for (item of phones(); track item.id) {
            <li class="flex items-center justify-between gap-3 py-3">
              <span class="font-mono text-ink">{{ item.display_phone_number }}</span>
              <button type="button" class="font-semibold text-danger" (click)="remove(item.id)">Deactivate</button>
            </li>
          } @empty { <li class="py-4 text-sm text-[var(--text-secondary)]">No active notification numbers.</li> }
        </ul>
      </div>
    </section>
  `,
})
export class AdminProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly auth = inject(AuthService);
  readonly phones = signal<NotificationPhone[]>([]);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  phone = '';

  ngOnInit(): void { this.load(); }

  add(): void {
    if (!this.phone.trim()) return;
    this.saving.set(true);
    this.message.set(null);
    this.api.post<NotificationPhone>('/auth/profile/notification-phones/', { phone_number: this.phone }).subscribe({
      next: () => { this.phone = ''; this.saving.set(false); this.load(); },
      error: (error: unknown) => { this.saving.set(false); this.message.set(error instanceof AppError ? error.message : 'Invalid phone number.'); },
    });
  }

  remove(id: string): void {
    this.api.delete(`/auth/profile/notification-phones/${id}/`).subscribe({ next: () => this.load() });
  }

  private load(): void {
    this.api.get<NotificationPhone[]>('/auth/profile/notification-phones/').subscribe({
      next: (rows) => this.phones.set((Array.isArray(rows) ? rows : []).filter((row) => row.is_active)),
    });
  }
}
