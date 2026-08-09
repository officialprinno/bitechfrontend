import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AppError } from '../../core/models/app-error';
import { PortalSessionService } from '../../core/portal/portal-session.service';
import {
  LookupVoucherItem,
  MacLookupResult,
  PhoneLookupResult,
  VoucherLookupService,
} from '../../core/vouchers/voucher-lookup.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

const LOOKUP_TOKEN_KEY = 'bitech.lookup.token';

@Component({
  selector: 'app-voucher-lookup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ErrorStateComponent,
    SkeletonComponent,
    RouterLink,
    DecimalPipe,
  ],
  template: `
    <section class="space-y-6">
      <div>
        <a routerLink="/" class="text-sm font-semibold text-signal no-underline">← Rudi</a>
        <h1 class="mt-3 font-display text-2xl font-bold text-ink">Angalia voucher</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Kwenye WiFi captive — MAC. Nje — thibitisha namba kwa OTP.
        </p>
      </div>

      @if (macLoading()) {
        <app-skeleton height="5rem" />
      }

      @if (macResult(); as mac) {
        <div class="space-y-3">
          <h2 class="font-display text-base font-semibold text-ink">
            Kifaa hiki ({{ mac.mac_address }})
          </h2>
          @if (mac.vouchers.length === 0) {
            <p class="text-sm text-[var(--text-secondary)]">Hakuna voucher kwenye MAC hii.</p>
          } @else {
            @for (v of mac.vouchers; track v.id) {
              <div class="rounded-xl border border-border bg-surface-1 px-4 py-3 text-left shadow-soft">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-display font-semibold text-ink">{{ v.package_name }}</p>
                    <p class="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {{ v.site_name }} · {{ v.status }}
                    </p>
                  </div>
                  @if (v.username) {
                    <p class="font-display text-lg font-bold tracking-wider text-signal">
                      {{ v.username }}
                    </p>
                  }
                </div>
              </div>
            }
          }
        </div>
      } @else if (macError()) {
        <p class="text-sm text-[var(--text-secondary)]">{{ macError() }}</p>
      }

      <div class="space-y-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
        <h2 class="font-display text-base font-semibold text-ink">Kwa namba ya simu (OTP)</h2>

        @if (!phoneResult()) {
          <form class="space-y-3" [formGroup]="phoneForm" (ngSubmit)="requestOtp()">
            <label class="block space-y-1.5">
              <span class="text-sm font-semibold text-ink">Namba ya simu</span>
              <input
                formControlName="phone"
                inputmode="tel"
                placeholder="07XXXXXXXX"
                class="w-full rounded-xl border border-border bg-surface-0 px-3 py-3 text-sm outline-none focus:border-signal"
              />
            </label>
            <app-button type="submit" [loading]="otpLoading()" [disabled]="phoneForm.invalid">
              Tuma OTP
            </app-button>
          </form>

          @if (otpSent()) {
            <form class="space-y-3" [formGroup]="otpForm" (ngSubmit)="verifyOtp()">
              <label class="block space-y-1.5">
                <span class="text-sm font-semibold text-ink">OTP (tarakimu 6)</span>
                <input
                  formControlName="otp"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="123456"
                  class="w-full rounded-xl border border-border bg-surface-0 px-3 py-3 text-sm tracking-widest outline-none focus:border-signal"
                />
              </label>
              @if (debugOtp()) {
                <p class="text-xs text-warning">Dev OTP: {{ debugOtp() }}</p>
              }
              <app-button type="submit" [loading]="verifyLoading()" [disabled]="otpForm.invalid">
                Thibitisha
              </app-button>
            </form>
          }
        }

        @if (formError()) {
          <app-error-state title="Hitilafu" [message]="formError()!" />
        }

        @if (phoneResult(); as data) {
          <div class="space-y-4">
            <p class="text-sm text-[var(--text-secondary)]">
              {{ data.customer.phone_number }} · ununuzi {{ data.customer.total_purchases }} · TZS
              {{ data.customer.total_spent | number: '1.0-0' }}
            </p>

            <div class="space-y-2">
              <h3 class="font-display text-sm font-semibold text-ink">Voucher zangu (self)</h3>
              @for (v of data.mine; track v.id) {
                <div class="rounded-xl border border-border bg-surface-0/80 px-4 py-3 text-left">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-display font-semibold text-ink">{{ v.package_name }}</p>
                      <p class="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {{ v.site_name }} · {{ v.status }}
                      </p>
                    </div>
                    @if (v.username) {
                      <p class="font-display text-lg font-bold tracking-wider text-signal">
                        {{ v.username }}
                      </p>
                    }
                  </div>
                  @if (v.bound_device_name || v.mac_address) {
                    <p class="mt-2 text-xs text-[var(--text-secondary)]">
                      @if (v.bound_device_name) {
                        Kifaa: {{ v.bound_device_name }}
                      }
                      @if (v.mac_address) {
                        · {{ v.mac_address }}
                      }
                    </p>
                  }
                </div>
              } @empty {
                <p class="text-sm text-[var(--text-secondary)]">Hakuna.</p>
              }
            </div>

            <div class="space-y-2">
              <h3 class="font-display text-sm font-semibold text-ink">
                Nilizonunua kwa wengine (gift)
              </h3>
              @for (v of data.gifted; track v.id) {
                <div class="rounded-xl border border-border bg-surface-0/80 px-4 py-3 text-left">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-display font-semibold text-ink">{{ v.package_name }}</p>
                      <p class="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {{ v.site_name }} · {{ v.status }}
                        @if (v.is_mac_bound) {
                          · imefungwa
                        }
                      </p>
                    </div>
                    @if (v.username) {
                      <p class="font-display text-lg font-bold tracking-wider text-signal">
                        {{ v.username }}
                      </p>
                    }
                  </div>
                  @if (v.bound_device_name) {
                    <p class="mt-2 text-xs text-[var(--text-secondary)]">
                      Kifaa: {{ v.bound_device_name }}
                    </p>
                  }
                </div>
              } @empty {
                <p class="text-sm text-[var(--text-secondary)]">Hakuna.</p>
              }
            </div>

            <button
              type="button"
              class="text-sm font-semibold text-signal"
              (click)="clearPhoneLookup()"
            >
              Badilisha namba
            </button>
          </div>
        }
      </div>
    </section>
  `,
})
export class VoucherLookupComponent implements OnInit {
  private readonly lookup = inject(VoucherLookupService);
  private readonly portal = inject(PortalSessionService);
  private readonly fb = inject(FormBuilder);

  readonly macLoading = signal(false);
  readonly macResult = signal<MacLookupResult | null>(null);
  readonly macError = signal<string | null>(null);

  readonly otpLoading = signal(false);
  readonly verifyLoading = signal(false);
  readonly otpSent = signal(false);
  readonly debugOtp = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly phoneResult = signal<PhoneLookupResult | null>(null);

  readonly phoneForm = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.pattern(/^(?:\+?255|0)(6\d{8}|7\d{8})$/)]],
  });
  readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    const session = this.portal.session();
    if (session?.mac && session.session_token) {
      this.macLoading.set(true);
      this.lookup.byMac(session.session_token).subscribe({
        next: (res) => {
          this.macResult.set(res);
          this.macLoading.set(false);
        },
        error: (err: unknown) => {
          this.macLoading.set(false);
          this.macError.set(
            err instanceof AppError
              ? err.message
              : 'MAC lookup haipatikani — tumia OTP.',
          );
        },
      });
    }

    const saved = sessionStorage.getItem(LOOKUP_TOKEN_KEY);
    if (saved) {
      this.loadMine(saved);
    }
  }

  requestOtp(): void {
    if (this.phoneForm.invalid) return;
    this.formError.set(null);
    this.otpLoading.set(true);
    const phone = this.phoneForm.controls.phone.value;
    this.lookup.requestOtp(phone).subscribe({
      next: (res) => {
        this.otpLoading.set(false);
        this.otpSent.set(true);
        this.debugOtp.set(res.debug_otp || null);
      },
      error: (err: unknown) => {
        this.otpLoading.set(false);
        this.formError.set(err instanceof AppError ? err.message : 'Imeshindikana kutuma OTP.');
      },
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid || this.phoneForm.invalid) return;
    this.formError.set(null);
    this.verifyLoading.set(true);
    this.lookup
      .verifyOtp(this.phoneForm.controls.phone.value, this.otpForm.controls.otp.value)
      .subscribe({
        next: (res) => {
          this.verifyLoading.set(false);
          sessionStorage.setItem(LOOKUP_TOKEN_KEY, res.lookup_token);
          this.loadMine(res.lookup_token);
        },
        error: (err: unknown) => {
          this.verifyLoading.set(false);
          this.formError.set(err instanceof AppError ? err.message : 'OTP si sahihi.');
        },
      });
  }

  clearPhoneLookup(): void {
    sessionStorage.removeItem(LOOKUP_TOKEN_KEY);
    this.phoneResult.set(null);
    this.otpSent.set(false);
    this.debugOtp.set(null);
    this.otpForm.reset();
  }

  private loadMine(token: string): void {
    this.lookup.mine(token).subscribe({
      next: (res) => this.phoneResult.set(res),
      error: () => {
        sessionStorage.removeItem(LOOKUP_TOKEN_KEY);
      },
    });
  }
}
