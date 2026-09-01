import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';

import { AppError } from '../../../core/models/app-error';
import { PurchaseType } from '../../../core/models/portal.model';
import { PaymentService } from '../../../core/payments/payment.service';
import { PortalSessionService } from '../../../core/portal/portal-session.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';

interface ProviderOption {
  id: string;
  label: string;
  accent: string;
  mark: string;
}

const PROVIDERS: ProviderOption[] = [
  { id: 'Mpesa', label: 'M-Pesa', accent: '#00A651', mark: 'M' },
  { id: 'Tigo', label: 'Tigo Pesa', accent: '#00377D', mark: 'T' },
  { id: 'Airtel', label: 'Airtel Money', accent: '#ED1C24', mark: 'A' },
  { id: 'Halopesa', label: 'HaloPesa', accent: '#F36C00', mark: 'H' },
];

@Component({
  selector: 'app-portal-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ErrorStateComponent, DecimalPipe, RouterLink],
  template: `
    <section class="space-y-6">
      <div>
        <a routerLink="/" class="text-sm font-semibold text-signal no-underline">← Rudi</a>
        <h1 class="mt-3 font-display text-2xl font-bold text-ink">Malipo</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">Hatua 2 kati ya 3 · AzamPay USSD</p>
      </div>

      @if (!pkg() || !session()) {
        <app-error-state
          title="Session au package haipo"
          message="Rudi chagua kifurushi kwanza."
        >
          <a routerLink="/" class="mt-4 inline-block font-semibold text-signal">Chagua package</a>
        </app-error-state>
      } @else {
        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <p class="text-sm text-[var(--text-secondary)]">{{ session()!.site.name }}</p>
          <h2 class="mt-1 font-display text-xl font-semibold text-ink">{{ pkg()!.name }}</h2>
          <p class="mt-2 font-display text-2xl font-bold text-signal">
            TZS {{ pkg()!.price_tzs | number: '1.0-0' }}
          </p>
        </div>

        <form class="space-y-5" [formGroup]="form" (ngSubmit)="submit()">
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold text-ink">Aina ya ununuzi</legend>

            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4"
              [class.opacity-50]="!canSelf()"
              [class.pointer-events-none]="!canSelf()"
            >
              <input
                type="radio"
                formControlName="purchase_type"
                value="self"
                class="mt-1"
                [disabled]="!canSelf()"
              />
              <span>
                <span class="block font-semibold text-ink">Nunua kwa kifaa hiki</span>
                <span class="mt-1 block text-sm text-[var(--text-secondary)]">
                  @if (session()?.mac) {
                    MAC {{ session()!.mac }} itafungwa kwenye voucher mara baada ya malipo.
                  } @else {
                    Auto-login baada ya malipo; MAC itafungwa kifaa kikifanikiwa kuingia.
                  }
                </span>
              </span>
            </label>

            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4"
            >
              <input type="radio" formControlName="purchase_type" value="gift" class="mt-1" />
              <span>
                <span class="block font-semibold text-ink">Nunua kwa mtu/kifaa kingine</span>
                <span class="mt-1 block text-sm text-[var(--text-secondary)]">
                  Utapata code ya kushiriki. Kifaa cha kwanza kinachoingia kinafungwa (MAC) —
                  haitumiki kwenye vifaa viwili.
                </span>
              </span>
            </label>
          </fieldset>

          <label class="block space-y-1.5">
            <span class="text-sm font-semibold text-ink">Namba ya simu ya kulipia</span>
            <input
              formControlName="phone"
              inputmode="tel"
              placeholder="07XXXXXXXX"
              class="w-full rounded-xl border border-border bg-surface-1 px-3 py-3 text-sm text-ink outline-none focus:border-signal"
            />
          </label>

          @if (form.controls.purchase_type.value === 'gift') {
            <label class="block space-y-1.5">
              <span class="text-sm font-semibold text-ink">
                Namba ya mpokeaji (SMS) — hiari
              </span>
              <input
                formControlName="recipient_phone"
                inputmode="tel"
                placeholder="07XXXXXXXX"
                class="w-full rounded-xl border border-border bg-surface-1 px-3 py-3 text-sm text-ink outline-none focus:border-signal"
              />
              <span class="block text-xs text-[var(--text-secondary)]">
                Ikiwa SMS imewezeshwa, code itatumwa hapa. Acha wazi = code inaonekana kwako tu.
              </span>
            </label>
          }

          <fieldset>
            <legend class="mb-2 text-sm font-semibold text-ink">Chagua mtandao (MNP)</legend>
            <p class="mb-3 text-xs text-[var(--text-secondary)]">
              Chagua wewe mwenyewe — usitegemee default.
            </p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
              @for (p of providers; track p.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="form.controls.provider.value === p.id"
                  class="flex flex-col items-center gap-2 rounded-2xl border bg-surface-1 px-2 py-3 text-center transition"
                  [class.border-signal]="form.controls.provider.value === p.id"
                  [class.ring-2]="form.controls.provider.value === p.id"
                  [class.ring-signal/30]="form.controls.provider.value === p.id"
                  [class.border-border]="form.controls.provider.value !== p.id"
                  (click)="selectProvider(p.id)"
                >
                  <span
                    class="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
                    [style.background]="p.accent"
                    aria-hidden="true"
                  >
                    {{ p.mark }}
                  </span>
                  <span class="text-xs font-semibold text-ink">{{ p.label }}</span>
                </button>
              }
            </div>
            @if (form.controls.provider.touched && form.controls.provider.invalid) {
              <p class="mt-2 text-sm text-warning">Chagua mtandao kabla ya kulipa.</p>
            }
          </fieldset>

          @if (error()) {
            <app-error-state title="Imeshindikana" [message]="error()!" />
          }

          <app-button type="submit" [loading]="loading()" [disabled]="form.invalid">
            Lipa sasa
          </app-button>
        </form>
      }
    </section>
  `,
})
export class PortalCheckoutComponent implements OnInit, OnDestroy {
  private readonly portal = inject(PortalSessionService);
  private readonly payments = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly session = this.portal.session;
  readonly pkg = this.portal.selectedPackage;
  readonly canSelf = this.portal.canPurchaseSelf;
  readonly providers = PROVIDERS;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly phonePattern = /^(?:\+?255|0)(6\d{8}|7\d{8})$/;

  readonly form = this.fb.nonNullable.group({
    purchase_type: this.fb.nonNullable.control<PurchaseType>('self'),
    phone: ['', [Validators.required, Validators.pattern(this.phonePattern)]],
    recipient_phone: [
      '',
      [Validators.pattern(/^(?:\+?255|0)(6\d{8}|7\d{8})$|^$/)],
    ],
    // User must pick MNP explicitly (no M-Pesa default)
    provider: ['', Validators.required],
  });

  private phoneSub?: Subscription;

  ngOnInit(): void {
    const applyPurchaseDefault = () => {
      if (!this.canSelf()) {
        this.form.controls.purchase_type.setValue('gift');
      } else {
        this.form.controls.purchase_type.setValue(this.portal.purchaseType());
      }
    };

    if (this.session()) {
      this.portal.refreshSession('self').subscribe({
        next: () => applyPurchaseDefault(),
        error: () => {
          this.portal.clear();
          this.error.set('Session imeisha. Rudi chagua site/package upya.');
        },
      });
    } else {
      applyPurchaseDefault();
    }
  }

  ngOnDestroy(): void {
    this.phoneSub?.unsubscribe();
  }

  selectProvider(id: string): void {
    this.form.controls.provider.setValue(id);
    this.form.controls.provider.markAsTouched();
  }

  submit(): void {
    this.form.controls.provider.markAsTouched();
    if (this.form.invalid || !this.pkg() || !this.session()) return;
    const { purchase_type, phone, provider, recipient_phone } = this.form.getRawValue();
    this.portal.setPurchaseType(purchase_type);
    this.loading.set(true);
    this.error.set(null);

    const runCheckout = () =>
      this.payments.checkout({
        session_token: this.portal.session()!.session_token,
        package_id: this.pkg()!.id,
        purchase_type,
        phone_number: phone,
        recipient_phone:
          purchase_type === 'gift' && recipient_phone.trim()
            ? recipient_phone.trim()
            : undefined,
        provider,
      });

    this.portal
      .refreshSession(purchase_type)
      .pipe(switchMap(() => runCheckout()))
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          void this.router.navigate(['/pay/waiting', res.payment_id], {
            queryParams: { mock: res.mock_mode ? '1' : '0' },
          });
        },
        error: (err: unknown) => {
          if (
            err instanceof AppError &&
            (err.code === 'SESSION_EXPIRED' || err.code === 'SESSION_INVALID')
          ) {
            this.portal
              .refreshSession(purchase_type)
              .pipe(switchMap(() => runCheckout()))
              .subscribe({
                next: (res) => {
                  this.loading.set(false);
                  void this.router.navigate(['/pay/waiting', res.payment_id], {
                    queryParams: { mock: res.mock_mode ? '1' : '0' },
                  });
                },
                error: (err2: unknown) => {
                  this.loading.set(false);
                  this.error.set(
                    err2 instanceof AppError
                      ? err2.message
                      : 'Imeshindikana kuanzisha malipo.',
                  );
                },
              });
            return;
          }
          this.loading.set(false);
          this.error.set(
            err instanceof AppError ? err.message : 'Imeshindikana kuanzisha malipo.',
          );
        },
      });
  }
}
