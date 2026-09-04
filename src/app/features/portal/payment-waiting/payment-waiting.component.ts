import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subscription, catchError, switchMap, timer } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AppError } from '../../../core/models/app-error';
import {
  PaymentCheckoutSummary,
  PaymentDelivery,
  PaymentService,
  PaymentStatusResponse,
} from '../../../core/payments/payment.service';
import { HotspotLoginService } from '../../../core/portal/hotspot-login.service';
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
      @if (copyMessage()) {
        <div
          class="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-soft"
          [class.bg-success]="!copyMessageIsError()"
          [class.bg-danger]="copyMessageIsError()"
          role="status"
          aria-live="polite"
          data-testid="copy-success-message"
        >
          {{ copyMessage() }}
        </div>
      }

      <div>
        <div
          class="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider"
          [class]="statusBadgeClass()"
        >
          <span class="h-2 w-2 rounded-full" [class]="statusDotClass()"></span>
          {{ statusBadgeLabel() }}
        </div>
        <h1
          class="font-display text-2xl font-bold transition-colors duration-300"
          [class]="statusHeadingClass()"
          aria-live="polite"
          data-testid="payment-main-title"
        >
          {{ headline() }}
        </h1>
        <p class="mt-2 text-sm text-[var(--text-secondary)]">{{ subline() }}</p>
      </div>

      @if (status(); as s) {
        <div class="rounded-2xl border border-border bg-surface-1 p-5 text-left shadow-soft">
          <p class="text-sm text-[var(--text-secondary)]">{{ s.site_name }}</p>
          <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-[var(--text-secondary)]">Kifurushi</dt>
              <dd class="font-semibold text-ink">{{ s.package_name }}</dd>
            </div>
            <div>
              <dt class="text-[var(--text-secondary)]">Kiasi cha kulipa</dt>
              <dd class="font-semibold text-ink">
                @if (checkoutSummary(); as summary) {
                  {{ summary.currency }} {{ summary.amount }}
                } @else {
                  —
                }
              </dd>
            </div>
            <div>
              <dt class="text-[var(--text-secondary)]">Namba ya malipo</dt>
              <dd class="font-semibold text-ink">{{ checkoutSummary()?.phone_number || '—' }}</dd>
            </div>
            <div>
              <dt class="text-[var(--text-secondary)]">Mtandao</dt>
              <dd class="font-semibold text-ink">{{ s.provider }}</dd>
            </div>
          </dl>
          <p class="mt-4 border-t border-border pt-3 text-sm">
            Status ya malipo:
            <span class="font-semibold" [class]="statusClass(s.status)">{{ statusLabel(s.status) }}</span>
          </p>
        </div>
      } @else if (loading()) {
        <app-skeleton height="6rem" />
      }

      @if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
        @if (!timedOut()) {
          <button type="button" class="font-semibold text-signal" (click)="recheck()">
            Angalia tena
          </button>
        }
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
          <p class="font-display text-lg font-semibold text-success">Voucher yako</p>

          @if (delivery(); as d) {
            @if (d.provisioning_status === 'success' && d.username) {
              @if (d.instructions) {
                <p class="text-sm text-[var(--text-secondary)]">{{ d.instructions }}</p>
              }

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
                  </div>

                  @if (d.purchase_type === 'self') {
                    <div class="mt-5 rounded-xl border border-border bg-surface-0/50 p-4">
                      <p class="text-sm font-semibold text-ink">Unataka kuunganisha vipi?</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        @if (d.can_auto_login) {
                          <app-button type="button" (click)="triggerAutoLogin()">
                            Unganisha automatic
                          </app-button>
                        }
                        <app-button type="button" variant="secondary" (click)="chooseManual()">
                          Ingiza manual
                        </app-button>
                      </div>
                      @if (!d.can_auto_login) {
                        <p class="mt-2 text-xs text-[var(--text-secondary)]">
                          Automatic haipatikani kwenye connection hii; tumia manual.
                        </p>
                      }
                      @if (manualSelected()) {
                        <p class="mt-3 text-sm text-[var(--text-secondary)]">
                          Fungua login ya Bitech WiFi, kisha tumia
                          <strong class="text-ink">{{ d.username }}</strong> kama username na password.
                        </p>
                      }
                    </div>
                  }

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
  private readonly pageTitle = inject(Title);
  private readonly payments = inject(PaymentService);
  private readonly hotspotLogin = inject(HotspotLoginService);

  readonly loading = signal(true);
  readonly mocking = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<PaymentStatusResponse | null>(null);
  readonly timedOut = signal(false);
  readonly mockMode = signal(false);
  readonly copied = signal(false);
  readonly copyMessage = signal<string | null>(null);
  readonly copyMessageIsError = signal(false);
  readonly manualSelected = signal(false);
  readonly checkoutSummary = signal<PaymentCheckoutSummary | null>(null);
  readonly paymentGateway = signal<'pesapal' | 'azampay'>('azampay');

  readonly delivery = computed(() => {
    const d = this.status()?.delivery;
    return d && typeof d === 'object' ? d : null;
  });

  readonly headline = computed(() => {
    const s = this.status()?.status;
    if (s === 'success') return 'Malipo yamekamilika!';
    if (s === 'failed') return 'Malipo yameshindikana';
    if (s === 'expired') return 'Muda wa malipo umeisha';
    return 'Inasubiri malipo…';
  });

  readonly statusBadgeLabel = computed(() => {
    const status = this.status()?.status;
    if (status === 'success') return 'Malipo yamepokelewa';
    if (status === 'failed') return 'Malipo yamekataliwa';
    if (status === 'expired') return 'Muda umeisha';
    return 'Inathibitisha malipo';
  });

  readonly statusHeadingClass = computed(() => {
    const status = this.status()?.status;
    if (status === 'success') return 'text-success';
    if (status === 'failed' || status === 'expired') return 'text-danger';
    return 'text-warning';
  });

  readonly statusBadgeClass = computed(() => {
    const status = this.status()?.status;
    if (status === 'success') return 'border-success/30 bg-success/10 text-success';
    if (status === 'failed' || status === 'expired') {
      return 'border-danger/30 bg-danger/10 text-danger';
    }
    return 'border-warning/30 bg-warning/10 text-warning';
  });

  readonly statusDotClass = computed(() => {
    const status = this.status()?.status;
    if (status === 'success') return 'bg-success';
    if (status === 'failed' || status === 'expired') return 'bg-danger';
    return 'bg-warning animate-pulse';
  });

  readonly subline = computed(() => {
    const s = this.status()?.status;
    if (s === 'success') {
      const d = this.delivery();
      if (d?.provisioning_status === 'success') {
        return d.purchase_type === 'gift'
          ? 'Shiriki code hapa chini.'
          : 'Voucher yako iko tayari. Nakili code, kisha chagua namna ya kuunganisha.';
      }
      if (d?.provisioning_status === 'failed') {
        return 'Malipo yamepokelewa — voucher inahitaji support.';
      }
      return 'Voucher inaandaliwa…';
    }
    if (s === 'failed' || s === 'expired') return 'Unaweza jaribu tena kutoka checkout.';
    return this.paymentGateway() === 'pesapal'
      ? 'Malipo yanathibitishwa... Usifunge ukurasa huu.'
      : 'Thibitisha USSD push kwenye simu yako (weka PIN).';
  });

  private sub?: Subscription;
  private copyMessageTimer?: ReturnType<typeof setTimeout>;
  private paymentId = '';

  ngOnInit(): void {
    const activePayment = this.payments.getActivePayment();
    const resultToken = this.route.snapshot.queryParamMap.get('result_token')?.trim() || '';
    this.paymentId = this.route.snapshot.paramMap.get('paymentId') || activePayment?.payment_id || '';
    if (activePayment?.payment_id === this.paymentId) {
      this.paymentGateway.set(activePayment.payment_gateway);
      this.payments.storePollToken(activePayment.payment_id, activePayment.poll_token);
      if (resultToken) {
        this.recoverResult(resultToken, activePayment.payment_id);
        return;
      }
    }
    this.checkoutSummary.set(this.payments.getCheckoutSummary(this.paymentId));
    this.mockMode.set(this.route.snapshot.queryParamMap.get('mock') === '1');
    if (!this.paymentId) {
      if (resultToken) {
        this.recoverResult(resultToken);
        return;
      }
      this.loading.set(false);
      this.error.set(
        'Taarifa za kurejesha matokeo ya malipo hazipatikani. Rudi checkout ukihitaji kuanza tena.',
      );
      return;
    }
    if (!this.payments.getPollToken(this.paymentId)) {
      this.loading.set(false);
      this.error.set(
        'Kiungo hiki hakina ruhusa ya kuangalia malipo. Rudi checkout uanze tena.',
      );
      return;
    }

    this.startPolling();
  }

  private recoverResult(resultToken: string, expectedPaymentId = ''): void {
    this.payments.recoverResult(resultToken).subscribe({
      next: (context) => {
        this.removeResultToken();
        if (expectedPaymentId && context.payment_id !== expectedPaymentId) {
          this.loading.set(false);
          this.error.set('Kiungo cha matokeo hakilingani na malipo yaliyohifadhiwa.');
          return;
        }
        this.payments.storePaymentState(context);
        this.paymentId = context.payment_id;
        this.paymentGateway.set(context.payment_gateway);
        this.checkoutSummary.set({
          amount: context.display.amount,
          currency: context.display.currency,
          phone_number: '',
          purchase_type: 'self',
        });
        this.startPolling();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'Kiungo cha matokeo ya malipo si halali au muda wake umeisha. Rudi checkout ukihitaji kuanza tena.',
        );
      },
    });
  }

  private removeResultToken(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { result_token: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  recheck(): void {
    if (this.sub && !this.sub.closed) return;
    this.startPolling();
  }

  private startPolling(): void {
    const started = Date.now();
    this.error.set(null);
    this.timedOut.set(false);
    this.sub = timer(0, environment.paymentPollIntervalMs)
      .pipe(
        switchMap(() => this.payments.status(this.paymentId).pipe(
          catchError((err: unknown) => {
            this.loading.set(false);
            this.error.set(err instanceof AppError ? err.message : 'Imeshindikana kuangalia hali kwa muda.');
            if (Date.now() - started >= environment.paymentPollTimeoutMs) {
              this.timedOut.set(true);
              this.sub?.unsubscribe();
            }
            return EMPTY;
          }),
        )),
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.error.set(null);
          this.applyStatus(res);
          if (this.isSettled(this.status())) {
            this.sub?.unsubscribe();
          } else if (Date.now() - started >= environment.paymentPollTimeoutMs) {
            this.timedOut.set(true);
            this.sub?.unsubscribe();
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.copyMessageTimer) clearTimeout(this.copyMessageTimer);
  }

  chooseManual(): void {
    this.manualSelected.set(true);
  }

  async copyCode(code: string): Promise<void> {
    try {
      await this.writeToClipboard(code);
      this.copied.set(true);
      this.copyMessageIsError.set(false);
      this.copyMessage.set('Umefanikiwa kunakili voucher.');
    } catch {
      this.copied.set(false);
      this.copyMessageIsError.set(true);
      this.copyMessage.set('Imeshindikana kunakili. Bonyeza code kwa muda kisha uchague Copy.');
    }
    if (this.copyMessageTimer) clearTimeout(this.copyMessageTimer);
    this.copyMessageTimer = setTimeout(() => {
      this.copied.set(false);
      this.copyMessage.set(null);
      this.copyMessageIsError.set(false);
    }, 3000);
  }

  private async writeToClipboard(value: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Captive portals commonly deny the modern Clipboard API; use the
        // selection-based fallback below before reporting a real failure.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy was rejected.');
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

  /**
   * MikroTik captive login — POST form to link-login (FR-6).
   * Browsers may block cross-origin navigation quietly; code fallback covers that.
   */
  private submitMikroTikLogin(d: PaymentDelivery): void {
    if (!d.username || !this.hotspotLogin.canSubmit()) {
      this.manualSelected.set(true);
      return;
    }
    this.hotspotLogin.submitHotspotLogin(d.username, d.password || d.username);
  }

  private applyStatus(res: PaymentStatusResponse): void {
    const current = this.status();
    if (!current) {
      this.commitStatus(res);
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

    this.commitStatus(res);
  }

  private commitStatus(res: PaymentStatusResponse): void {
    // Always publish a fresh immutable snapshot. Some response/interceptor paths
    // can reuse and mutate an object reference; signal equality would then leave
    // computed headline/badge/subline values cached at "pending" while direct
    // template reads already show "success".
    this.status.set({
      ...res,
      delivery: res.delivery ? { ...res.delivery } : null,
    });
    this.updatePageTitle(res.status);
  }

  private updatePageTitle(status: PaymentStatusResponse['status']): void {
    const title =
      status === 'success'
        ? 'Malipo yamekamilika — Bitech WiFi'
        : status === 'failed'
          ? 'Malipo yameshindikana — Bitech WiFi'
          : status === 'expired'
            ? 'Muda wa malipo umeisha — Bitech WiFi'
            : 'Inasubiri malipo — Bitech WiFi';
    this.pageTitle.setTitle(title);
  }

  private isSettled(res: PaymentStatusResponse | null): boolean {
    if (!res?.is_terminal) return false;
    if (res.status !== 'success') return true;
    const d = res.delivery;
    return !!d && (d.provisioning_status === 'success' || d.provisioning_status === 'failed');
  }
}
