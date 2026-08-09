import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AppError } from '../../../core/models/app-error';
import {
  PaymentDelivery,
  PaymentService,
  PaymentStatusResponse,
} from '../../../core/payments/payment.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  expired: 2,
  failed: 2,
  success: 2,
};

@Component({
  selector: 'app-payment-waiting',
  standalone: true,
  imports: [ButtonComponent, ErrorStateComponent, SkeletonComponent, RouterLink],
  template: `
    <section class="space-y-6 text-center">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">{{ headline() }}</h1>
        <p class="mt-2 text-sm text-[var(--text-secondary)]">{{ subline() }}</p>
      </div>

      @if (status(); as s) {
        <div class="rounded-2xl border border-border bg-surface-1 p-5 text-left shadow-soft">
          <p class="text-sm text-[var(--text-secondary)]">{{ s.site_name }} · {{ s.package_name }}</p>
          <p class="mt-1 font-display text-lg font-semibold text-ink">
            {{ s.provider }} · {{ s.phone_number }}
          </p>
          <p class="mt-3 text-sm">
            Hali:
            <span class="font-semibold" [class]="statusClass(s.status)">{{ statusLabel(s.status) }}</span>
          </p>
        </div>
      } @else if (loading()) {
        <app-skeleton height="6rem" />
      }

      @if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      }

      @if (timedOut() && status()?.status === 'pending') {
        <app-error-state
          title="Muda umeisha"
          message="Hakuna uthibitisho ndani ya dakika 3. Jaribu tena au angalia voucher baadaye."
        />
        <a routerLink="/checkout" class="inline-block font-semibold text-signal">Jaribu tena</a>
      }

      @if (mockMode() && status()?.status === 'pending') {
        <app-button (click)="triggerMockSuccess()" [loading]="mocking()">
          Mock: Thibitisha malipo (dev)
        </app-button>
      }

      @if (status()?.status === 'success') {
        <div class="rounded-2xl border border-success/30 bg-surface-1 p-5 text-left shadow-soft space-y-4">
          <p class="font-display text-lg font-semibold text-success">Malipo yamefanikiwa</p>

          @if (delivery(); as d) {
            @if (d.provisioning_status === 'success' && d.username) {
              @if (d.instructions) {
                <p class="text-sm text-[var(--text-secondary)]">{{ d.instructions }}</p>
              }

              <!-- Self auto-login attempt -->
              @if (d.can_auto_login && !showCodeFallback()) {
                <div class="rounded-xl border border-border bg-surface-0/50 p-4">
                  <p class="text-sm font-semibold text-ink">Inajaribu kukuunganisha…</p>
                  <p class="mt-1 text-xs text-[var(--text-secondary)]">
                    Ukirudi hapa, tumia code au bonyeza unganisha tena.
                  </p>
                  <div class="mt-4 flex flex-wrap gap-2">
                    <app-button type="button" (click)="triggerAutoLogin()">
                      Unganisha sasa
                    </app-button>
                    <app-button type="button" variant="secondary" (click)="revealCode()">
                      Nionyeshe code
                    </app-button>
                  </div>
                </div>
              }

              <!-- Gift primary / self fallback: show code -->
              @if (!d.can_auto_login || showCodeFallback()) {
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">
                    @if (d.purchase_type === 'gift') {
                      Code ya kushiriki:
                    } @else {
                      Code yako ya WiFi:
                    }
                  </p>
                  <p
                    class="mt-2 break-all font-display text-3xl font-bold tracking-widest text-ink"
                    data-testid="voucher-code"
                  >
                    {{ d.username }}
                  </p>
                  <p class="mt-2 text-xs text-[var(--text-secondary)]">
                    Username = password — ingiza code hiyo mara mbili kwenye login ya WiFi.
                  </p>

                  <div class="mt-4 flex flex-wrap gap-2">
                    <app-button type="button" (click)="copyCode(d.username!)">
                      {{ copied() ? 'Imenakiliwa ✓' : 'Nakili code' }}
                    </app-button>
                    @if (d.can_auto_login) {
                      <app-button type="button" variant="secondary" (click)="triggerAutoLogin()">
                        Unganisha sasa
                      </app-button>
                    }
                  </div>

                  @if (d.sms; as sms) {
                    @if (sms.enabled) {
                      <p class="mt-3 text-sm text-[var(--text-secondary)]">
                        @if (sms.status === 'sent') {
                          SMS imetumwa
                          @if (sms.phone) {
                            kwa {{ sms.phone }}
                          }
                        } @else if (sms.status === 'pending') {
                          SMS inatumwa…
                        } @else if (sms.status === 'failed') {
                          SMS haijatumwa — tumia code hapa juu.
                        }
                      </p>
                    }
                  }
                </div>
              }
            } @else if (d.provisioning_status === 'pending') {
              <p class="text-sm text-[var(--text-secondary)]">Voucher inaandaliwa…</p>
            } @else if (d.provisioning_status === 'failed') {
              <p class="text-sm text-warning">
                Malipo yamepokelewa, lakini voucher haijaundwa bado. Wasiliana na support.
              </p>
              @if (d.error) {
                <p class="mt-1 text-xs text-[var(--text-secondary)]">{{ d.error }}</p>
              }
            }
          } @else {
            <p class="text-sm text-[var(--text-secondary)]">Voucher inaandaliwa…</p>
          }

          <a routerLink="/" class="inline-block font-semibold text-signal">Rudi nyumbani</a>
        </div>
      }

      @if (status()?.status === 'failed' || status()?.status === 'expired') {
        <app-error-state
          [title]="status()!.status === 'expired' ? 'Malipo yameisha muda' : 'Malipo yameshindikana'"
          [message]="status()!.failure_reason || 'Jaribu tena.'"
        />
        <a routerLink="/checkout" class="inline-block font-semibold text-signal">Jaribu tena</a>
      }
    </section>
  `,
})
export class PaymentWaitingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly payments = inject(PaymentService);

  readonly loading = signal(true);
  readonly mocking = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<PaymentStatusResponse | null>(null);
  readonly timedOut = signal(false);
  readonly mockMode = signal(false);
  readonly showCodeFallback = signal(false);
  readonly copied = signal(false);
  readonly autoLoginStarted = signal(false);

  readonly delivery = computed(() => {
    const d = this.status()?.delivery;
    return d && typeof d === 'object' ? d : null;
  });

  readonly headline = computed(() => {
    const s = this.status()?.status;
    if (s === 'success') return 'Malipo yamefanikiwa';
    if (s === 'failed') return 'Malipo yameshindikana';
    if (s === 'expired') return 'Muda wa malipo umeisha';
    return 'Inasubiri malipo…';
  });

  readonly subline = computed(() => {
    const s = this.status()?.status;
    if (s === 'success') {
      const d = this.delivery();
      if (d?.provisioning_status === 'success') {
        if (d.can_auto_login && !this.showCodeFallback()) {
          return 'Inajaribu kukuunganisha kwenye WiFi…';
        }
        return d.purchase_type === 'gift'
          ? 'Shiriki code hapa chini.'
          : 'Tumia code au unganisha kwenye WiFi.';
      }
      if (d?.provisioning_status === 'failed') {
        return 'Malipo yamepokelewa — voucher inahitaji support.';
      }
      return 'Voucher inaandaliwa…';
    }
    if (s === 'failed' || s === 'expired') return 'Unaweza jaribu tena kutoka checkout.';
    return 'Thibitisha USSD push kwenye simu yako (weka PIN).';
  });

  private sub?: Subscription;
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  private paymentId = '';

  ngOnInit(): void {
    this.paymentId = this.route.snapshot.paramMap.get('paymentId') || '';
    this.mockMode.set(this.route.snapshot.queryParamMap.get('mock') === '1');
    if (!this.paymentId) {
      void this.router.navigateByUrl('/');
      return;
    }

    const started = Date.now();
    const uxTimeout = environment.paymentPollTimeoutMs;
    const interval = environment.paymentPollIntervalMs;

    this.sub = timer(0, interval)
      .pipe(switchMap(() => this.payments.status(this.paymentId)))
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.applyStatus(res);
          this.maybeStartDelivery(this.status()?.delivery ?? null);
          if (this.isSettled(this.status())) {
            this.sub?.unsubscribe();
          } else if (Date.now() - started >= uxTimeout) {
            this.timedOut.set(true);
            this.sub?.unsubscribe();
          }
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(err instanceof AppError ? err.message : 'Imeshindikana kuangalia hali.');
        },
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  revealCode(): void {
    this.showCodeFallback.set(true);
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }

  triggerAutoLogin(): void {
    const d = this.delivery();
    if (!d?.username) return;
    this.submitMikroTikLogin(d);
  }

  triggerMockSuccess(): void {
    this.mocking.set(true);
    this.payments.mockSuccess(this.paymentId).subscribe({
      next: () => {
        this.mocking.set(false);
        this.payments.status(this.paymentId).subscribe({
          next: (res) => {
            this.applyStatus(res);
            this.maybeStartDelivery(res.delivery);
            if (this.isSettled(res)) {
              this.sub?.unsubscribe();
            }
          },
        });
      },
      error: (err: unknown) => {
        this.mocking.set(false);
        this.error.set(err instanceof AppError ? err.message : 'Mock imeshindikana.');
      },
    });
  }

  statusLabel(status: string): string {
    if (status === 'success') return 'imefanikiwa';
    if (status === 'failed') return 'imeshindikana';
    if (status === 'expired') return 'imeisha muda';
    return 'inasubiri';
  }

  statusClass(status: string): string {
    if (status === 'success') return 'text-success';
    if (status === 'failed' || status === 'expired') return 'text-danger';
    return 'text-warning';
  }

  private maybeStartDelivery(d: PaymentDelivery | null): void {
    if (!d || d.provisioning_status !== 'success' || !d.username) return;

    // Gift: always show code (no auto-login)
    if (!d.can_auto_login) {
      this.showCodeFallback.set(true);
      return;
    }

    // Self: attempt auto-login once, then reveal code as fallback
    if (!this.autoLoginStarted()) {
      this.autoLoginStarted.set(true);
      // Short delay so user sees success UI before navigation
      setTimeout(() => this.submitMikroTikLogin(d), 700);
      this.fallbackTimer = setTimeout(() => this.showCodeFallback.set(true), 4500);
    }
  }

  /**
   * MikroTik captive login — POST form to link-login (FR-6).
   * Browsers may block cross-origin navigation quietly; code fallback covers that.
   */
  private submitMikroTikLogin(d: PaymentDelivery): void {
    const action = (d.auto_login?.action || d.link_login || '').trim();
    if (!action || !d.username) {
      this.showCodeFallback.set(true);
      return;
    }

    const method = (d.auto_login?.method || 'POST').toUpperCase();
    const userField = d.auto_login?.username_field || 'username';
    const passField = d.auto_login?.password_field || 'password';
    const password = d.password || d.username;

    if (method === 'GET') {
      const url = new URL(action, window.location.origin);
      url.searchParams.set(userField, d.username);
      url.searchParams.set(passField, password);
      window.location.href = url.toString();
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    form.acceptCharset = 'UTF-8';

    const u = document.createElement('input');
    u.name = userField;
    u.value = d.username;
    form.appendChild(u);

    const p = document.createElement('input');
    p.name = passField;
    p.value = password;
    form.appendChild(p);

    document.body.appendChild(form);
    form.submit();
  }

  private applyStatus(res: PaymentStatusResponse): void {
    const current = this.status();
    if (!current) {
      this.status.set(res);
      return;
    }

    const curRank = STATUS_RANK[current.status] ?? 0;
    const nextRank = STATUS_RANK[res.status] ?? 0;
    if (nextRank < curRank) return;

    if (res.status === 'success' && current.status === 'success') {
      const curReady =
        current.delivery?.provisioning_status === 'success' && !!current.delivery.username;
      const nextReady =
        res.delivery?.provisioning_status === 'success' && !!res.delivery.username;
      if (curReady && !nextReady) return;
    }

    this.status.set(res);
  }

  private isSettled(res: PaymentStatusResponse | null): boolean {
    if (!res?.is_terminal) return false;
    if (res.status !== 'success') return true;
    const d = res.delivery;
    return !!d && (d.provisioning_status === 'success' || d.provisioning_status === 'failed');
  }
}
