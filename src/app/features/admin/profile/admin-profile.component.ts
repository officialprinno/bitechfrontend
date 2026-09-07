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
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          {{ auth.user()?.username }} · private notification settings
        </p>
      </div>
      <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
        <h2 class="font-display text-lg font-semibold text-ink">SMS notification numbers</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Administrative alerts are delivered independently to every active number.
        </p>
        <form class="mt-4 flex flex-col gap-2 sm:flex-row" (ngSubmit)="add()">
          <input
            name="phone"
            [(ngModel)]="phone"
            placeholder="0742... or +255742..."
            class="min-h-11 flex-1 rounded-xl border border-border bg-surface-0 px-3 text-ink"
          />
          <button
            type="submit"
            [disabled]="saving()"
            class="rounded-xl bg-signal px-4 py-2 font-semibold text-[var(--text-inverse)] disabled:opacity-60"
          >
            {{ editId ? 'Save number' : 'Add number' }}
          </button>
        </form>
        @if (message()) {
          <p class="mt-3 text-sm text-warning">{{ message() }}</p>
        }
        @if (pendingPhone) {
          <p class="my-4 text-sm">
            Confirm {{ pendingPhone.is_active ? 'deactivation' : 'reactivation' }} of
            {{ pendingPhone.display_phone_number }}?
          </p>
          <button
            class="mr-4 text-signal"
            (click)="
              update(pendingPhone.id, { is_active: !pendingPhone.is_active }); pendingPhone = null
            "
          >
            Confirm</button
          ><button (click)="pendingPhone = null">Cancel</button>
        }
        <ul class="mt-4 divide-y divide-border">
          @for (item of phones(); track item.id) {
            <li class="flex items-center justify-between gap-3 py-3">
              <span class="font-mono text-ink"
                >{{ item.display_phone_number }}
                <small
                  >{{ item.is_active ? 'Active' : 'Inactive'
                  }}{{ item.is_primary ? ' · Primary' : '' }}</small
                ></span
              >
              <div class="flex flex-wrap gap-3">
                <button
                  class="text-signal"
                  (click)="editId = item.id; phone = item.display_phone_number"
                >
                  Edit</button
                ><button class="text-signal" (click)="update(item.id, { is_primary: true })">
                  Make primary</button
                ><button class="text-signal" (click)="pendingPhone = item">
                  {{ item.is_active ? 'Deactivate' : 'Reactivate' }}
                </button>
              </div>
            </li>
          } @empty {
            <li class="py-4 text-sm text-[var(--text-secondary)]">
              No active notification numbers.
            </li>
          }
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
  editId = '';
  pendingPhone: NotificationPhone | null = null;
  update(id: string, body: Record<string, unknown>): void {
    this.api
      .patch('/auth/profile/notification-phones/' + id + '/', body)
      .subscribe({ next: () => this.load(), error: (e) => this.message.set(e.message) });
  }

  ngOnInit(): void {
    this.load();
  }

  add(): void {
    if (!this.phone.trim()) return;
    if (this.editId) {
      this.update(this.editId, { phone_number: this.phone });
      this.editId = '';
      this.phone = '';
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    this.api
      .post<NotificationPhone>('/auth/profile/notification-phones/', { phone_number: this.phone })
      .subscribe({
        next: () => {
          this.phone = '';
          this.saving.set(false);
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.message.set(error instanceof AppError ? error.message : 'Invalid phone number.');
        },
      });
  }

  remove(id: string): void {
    this.api
      .delete(`/auth/profile/notification-phones/${id}/`)
      .subscribe({ next: () => this.load() });
  }

  private load(): void {
    this.api.get<NotificationPhone[]>('/auth/profile/notification-phones/').subscribe({
      next: (rows) => this.phones.set(Array.isArray(rows) ? rows : []),
    });
  }
}
