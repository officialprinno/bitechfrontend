import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { HealthReadyData } from '../../../core/models/api.model';
import {
  ExpiredVoucherSummary,
  PortalPackage,
  PortalSite,
  PublicGiftNode,
} from '../../../core/models/portal.model';
import { HotspotLoginService } from '../../../core/portal/hotspot-login.service';
import { PortalSessionService } from '../../../core/portal/portal-session.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [
    ButtonComponent,
    ErrorStateComponent,
    SkeletonComponent,
    DecimalPipe,
    DatePipe,
    FormsModule,
    RouterLink,
  ],
  template: `
    <section class="space-y-8">
      <div class="space-y-3">
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Bitech WiFi</p>
        <h1 class="font-display text-[length:var(--text-hero)] font-bold leading-[1.1] text-ink">
          @if (session(); as s) {
            {{ s.site.name }}
          } @else {
            Intaneti kwa urahisi
          }
        </h1>
        <p class="max-w-md text-base text-[var(--text-secondary)]">
          @if (session()?.mode === 'captive') {
            Chagua kifurushi, lipia kwa simu, uunganishe papo hapo.
          } @else {
            Chagua site na kifurushi — unaweza kununua kwa mtu/kifaa kingine.
          }
        </p>
      </div>

      @if (!session() && !bootstrapping()) {
        <div class="space-y-3">
          <h2 class="font-display text-base font-semibold text-ink">Chagua site (Gift)</h2>
          @if (sitesLoading()) {
            <app-skeleton height="3rem" />
          } @else if (sitesError()) {
            <app-error-state title="Sites hazipatikani" [message]="sitesError()!" />
          } @else {
            <div class="grid gap-2">
              @for (site of sites(); track site.id) {
                <button
                  type="button"
                  class="rounded-2xl border border-border bg-surface-1 px-4 py-3 text-left shadow-soft transition hover:border-signal/50"
                  (click)="selectGiftSite(site)"
                >
                  <span class="font-display font-semibold text-ink">{{ site.name }}</span>
                  <span class="mt-1 block text-xs text-[var(--text-secondary)]">{{ site.slug }}</span>
                </button>
              }
            </div>
          }
        </div>
      }

      @if (selectedGiftSite() && !session()) {
        <div class="space-y-3">
          <h2 class="font-display text-base font-semibold text-ink">Chagua access point</h2>
          @if (nodesLoading()) {
            <app-skeleton height="3rem" />
          } @else if (nodesError()) {
            <app-error-state title="Access point haipatikani" [message]="nodesError()!" />
          } @else if (giftNodes().length > 1) {
            <div class="grid gap-2">
              @for (node of giftNodes(); track node.id) {
                <button type="button" class="rounded-2xl border border-border bg-surface-1 px-4 py-3 text-left shadow-soft transition hover:border-signal/50" (click)="selectGiftNode(node)">
                  <span class="font-display font-semibold text-ink">{{ node.display_name || node.node_identifier }}</span>
                </button>
              }
            </div>
          }
        </div>
      }

      @if (session(); as s) {
        <div class="space-y-2">
          <button
            type="button"
            class="text-sm font-semibold text-signal"
            (click)="backToSites()"
          >
            ← Badilisha site
          </button>
          <div class="rounded-xl border border-border bg-surface-1/80 px-4 py-3 text-sm text-[var(--text-secondary)]">
            Node: <span class="font-semibold text-ink">{{ s.node.node_identifier }}</span>
            ·
            <span [class]="s.node.is_online ? 'text-success' : 'text-warning'">
              {{ s.node.health_status }}
            </span>
            @if (!s.can_purchase_self) {
              <span class="mt-1 block text-warning">
                "Nunua kwa kifaa hiki" inahitaji kuingia kupitia WiFi captive (MikroTik).
              </span>
            }
          </div>
        </div>
      }

      @if (expiredVoucher(); as voucher) {
        <article
          class="overflow-hidden rounded-2xl border border-amber-300/70 bg-surface-1 shadow-soft"
          aria-labelledby="expired-voucher-title"
        >
          <div class="border-b border-amber-200 bg-amber-50 px-5 py-5">
            <div class="flex items-start gap-3">
              <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Voucher imeisha</p>
                <h2 id="expired-voucher-title" class="mt-1 font-display text-xl font-bold text-ink">
                  Muda wa Voucher Umeisha
                </h2>
                <p class="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Voucher yako ya <strong class="text-ink">{{ voucher.package_name }}</strong> imefikia mwisho wa muda wake.
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-5 p-5">
            <dl class="grid grid-cols-1 gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
              <div><dt class="text-[var(--text-secondary)]">Package</dt><dd class="mt-1 font-semibold text-ink">{{ voucher.package_name }}</dd></div>
              <div><dt class="text-[var(--text-secondary)]">Ilianza</dt><dd class="mt-1 font-semibold text-ink">{{ voucher.validity_started_at | date: 'd MMM y, h:mm a': '+0300' }}</dd></div>
              <div><dt class="text-[var(--text-secondary)]">Iliisha</dt><dd class="mt-1 font-semibold text-ink">{{ voucher.expires_at | date: 'd MMM y, h:mm a': '+0300' }}</dd></div>
              <div><dt class="text-[var(--text-secondary)]">Kifaa</dt><dd class="mt-1 break-words font-semibold text-ink">{{ voucher.device_name || 'Kifaa hakijulikani' }}</dd></div>
              <div><dt class="text-[var(--text-secondary)]">Voucher</dt><dd class="mt-1 font-mono text-base font-bold tracking-wider text-ink">{{ voucher.code }}</dd></div>
              @if (voucher.mac_address) {
                <div><dt class="text-[var(--text-secondary)]">MAC ya kifaa</dt><dd class="mt-1 font-mono text-xs font-semibold text-ink">{{ voucher.mac_address }}</dd></div>
              }
            </dl>
            <p class="rounded-xl bg-surface-0 px-4 py-3 text-sm leading-6 text-ink">
              Muda wa package yako umeisha. Nunua package nyingine ili kuendelea kutumia Internet.
            </p>
            <app-button (click)="buyAnotherPackage()">Nunua Package</app-button>
          </div>
        </article>
      }

      @if (!expiredVoucher()) {
      <div class="rounded-2xl border border-border bg-surface-1/90 p-5 shadow-soft">
        <h2 class="font-display text-lg font-semibold text-ink">Tayari una voucher?</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Ingiza code yako ili kuunganisha kifaa hiki kwenye WiFi.
        </p>

        <form class="mt-4 space-y-3" (ngSubmit)="connectWithVoucher()">
          <label for="voucher-code" class="block text-sm font-semibold text-ink">
            Code ya voucher
          </label>
          <input
            id="voucher-code"
            name="voucherCode"
            type="text"
            autocomplete="one-time-code"
            autocapitalize="none"
            spellcheck="false"
            maxlength="32"
            required
            [(ngModel)]="voucherCode"
            placeholder="Mfano: ab3k9m2x"
            class="min-h-12 w-full rounded-xl border border-border bg-surface-0 px-4 py-3 font-mono text-base tracking-wider text-ink placeholder:text-[var(--text-secondary)] focus:border-signal"
          />
          @if (voucherError()) {
            <p class="text-sm text-danger" role="alert">{{ voucherError() }}</p>
          }
          <app-button type="submit" [loading]="voucherChecking()">Unganisha kwa voucher</app-button>
        </form>

        @if (!session()?.link_login) {
          <p class="mt-4 rounded-xl bg-signal-muted px-4 py-3 text-sm text-ink">
            Unganisha kwanza kwenye Bitech WiFi, kisha fungua ukurasa huu kupitia login ya WiFi
            ili kutumia voucher.
          </p>
        }
      </div>
      }

      @if (hotspotError()) {
        <app-error-state title="Voucher haijaunganisha" [message]="hotspotError()!" />
      }

      <div id="packages" class="scroll-mt-4 space-y-3">
        <h2 class="font-display text-base font-semibold text-ink">Vifurushi</h2>

        @if (packagesLoading() || bootstrapping()) {
          <div class="space-y-3">
            <app-skeleton height="5rem" />
            <app-skeleton height="5rem" />
          </div>
        } @else if (packagesError()) {
          <app-error-state title="Packages hazipatikani" [message]="packagesError()!" />
        } @else {
          <div class="space-y-3">
            @for (pkg of packages(); track pkg.id) {
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface-1/90 p-4 text-left shadow-soft transition hover:border-signal/40"
                (click)="choosePackage(pkg)"
              >
                <div>
                  <h3 class="font-display text-lg font-semibold text-ink">{{ pkg.name }}</h3>
                  <p class="mt-1 text-sm text-[var(--text-secondary)]">
                    {{ formatDuration(pkg.duration_minutes) }}
                  </p>
                </div>
                <p class="font-display text-xl font-bold text-signal">
                  TZS {{ pkg.price_tzs | number: '1.0-0' }}
                </p>
              </button>
            } @empty {
              <app-error-state
                title="Hakuna packages"
                message="Endesha seed_catalog au chagua site nyingine."
              />
            }
          </div>
        }
      </div>

      <div class="rounded-2xl border border-border bg-surface-1/90 p-5 shadow-soft">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-base font-semibold text-ink">Hali ya mfumo</h2>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">Uhakiki wa API</p>
          </div>
          <app-button variant="secondary" [loading]="healthLoading()" (click)="refreshHealth()">
            Sasisha
          </app-button>
        </div>

        @if (healthLoading()) {
          <div class="mt-5 space-y-3">
            <app-skeleton height="1rem" />
          </div>
        } @else if (healthError()) {
          <div class="mt-5">
            <app-error-state title="API haipatikani" [message]="healthError()!" />
            <p class="mt-3 text-xs text-[var(--text-secondary)]">
              Hakikisha Django: <code>python manage.py runserver</code>
            </p>
          </div>
        } @else if (ready()) {
          <p class="mt-4 text-sm font-semibold text-success">API iko hai · DB {{ ready()!.checks.database.status }}</p>
        }
      </div>

      <p class="text-center text-sm">
        <a routerLink="/vouchers" class="font-semibold text-signal no-underline">Angalia voucher zangu</a>
      </p>
    </section>
  `,
})
export class PortalHomeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portal = inject(PortalSessionService);
  private readonly hotspotLogin = inject(HotspotLoginService);
  private readonly api = inject(ApiClient);

  readonly session = this.portal.session;
  readonly bootstrapping = signal(false);
  readonly packagesLoading = signal(false);
  readonly packagesError = signal<string | null>(null);
  readonly packages = signal<PortalPackage[]>([]);

  readonly sitesLoading = signal(false);
  readonly sitesError = signal<string | null>(null);
  readonly sites = signal<PortalSite[]>([]);
  readonly selectedGiftSite = signal<PortalSite | null>(null);
  readonly nodesLoading = signal(false);
  readonly nodesError = signal<string | null>(null);
  readonly giftNodes = signal<PublicGiftNode[]>([]);

  readonly healthLoading = signal(false);
  readonly healthError = signal<string | null>(null);
  readonly ready = signal<HealthReadyData | null>(null);
  readonly voucherError = signal<string | null>(null);
  readonly voucherChecking = signal(false);
  readonly enteredExpiredVoucher = signal<ExpiredVoucherSummary | null>(null);
  readonly expiredVoucher = computed(
    () => this.enteredExpiredVoucher() || this.session()?.expired_voucher || null,
  );
  readonly hotspotError = signal<string | null>(null);
  voucherCode = '';

  ngOnInit(): void {
    this.refreshHealth();
    const qp = this.route.snapshot.queryParamMap;
    const routerError = qp.get('error') || qp.get('error-orig') || '';
    if (routerError) {
      this.hotspotError.set(this.describeHotspotError(routerError));
    }
    const params = {
      site_id: qp.get('site_id') || undefined,
      node_id: qp.get('node_id') || undefined,
      mac: qp.get('mac') || undefined,
      ip: qp.get('ip') || undefined,
      link_login: qp.get('link-login') || qp.get('link_login') || undefined,
      link_orig: qp.get('link-orig') || qp.get('link_orig') || undefined,
      hotspot_error: routerError || undefined,
    };

    if (params.node_id) {
      this.bootstrapping.set(true);
      this.portal.createSession({ ...params, intent: 'self' }).subscribe({
        next: (session) => {
          this.bootstrapping.set(false);
          this.loadPackagesForNode(session.node.node_identifier);
        },
        error: (err: unknown) => {
          this.bootstrapping.set(false);
          this.packagesError.set(
            err instanceof AppError ? err.message : 'Imeshindikana kuanzisha session.',
          );
          this.loadGiftSites();
        },
      });
      return;
    }

    if (this.portal.session()) {
      const s = this.portal.session()!;
      // Re-issue token so checkout does not hit SESSION_EXPIRED from stale storage
      this.bootstrapping.set(true);
      this.portal.refreshSession('self').subscribe({
        next: (session) => {
          this.bootstrapping.set(false);
          this.loadPackagesForNode(session.node.node_identifier);
        },
        error: () => {
          this.portal.clear();
          this.bootstrapping.set(false);
          this.loadGiftSites();
        },
      });
      return;
    }

    this.loadGiftSites();
  }

  backToSites(): void {
    this.enteredExpiredVoucher.set(null);
    this.portal.clear();
    this.packages.set([]);
    this.packagesError.set(null);
    this.selectedGiftSite.set(null);
    this.giftNodes.set([]);
    this.nodesError.set(null);
    this.loadGiftSites();
  }

  selectGiftSite(site: PortalSite): void {
    this.enteredExpiredVoucher.set(null);
    this.portal.clear();
    this.selectedGiftSite.set(site);
    this.giftNodes.set([]);
    this.nodesLoading.set(true);
    this.nodesError.set(null);
    this.packages.set([]);
    this.packagesLoading.set(false);
    this.packagesError.set(null);
    this.portal.listSiteNodes(site.slug).subscribe({
      next: (nodes) => {
        this.giftNodes.set(nodes);
        this.nodesLoading.set(false);
        const automatic = automaticGiftNode(nodes);
        if (automatic) this.selectGiftNode(automatic);
        if (nodes.length === 0) {
          this.nodesError.set('Site hii haina access point inayopatikana kwa sasa.');
        }
      },
      error: (err: unknown) => {
        this.nodesLoading.set(false);
        this.nodesError.set(
          err instanceof AppError ? err.message : 'Access point hazipatikani.',
        );
      },
    });
  }

  selectGiftNode(node: PublicGiftNode): void {
    const site = this.selectedGiftSite();
    if (!site) return;
    this.portal.clear();
    this.packages.set([]);
    this.packagesError.set(null);
    this.packagesLoading.set(true);
    this.portal
      .createSession({ site_id: site.slug, node_id: node.node_identifier, intent: 'gift' })
      .subscribe({
        next: (session) => this.loadPackagesForNode(session.node.node_identifier),
        error: (err: unknown) => {
          this.packagesError.set(
            err instanceof AppError ? err.message : 'Imeshindikana kuanzisha session.',
          );
          this.packagesLoading.set(false);
        },
      });
  }

  choosePackage(pkg: PortalPackage): void {
    this.portal.selectPackage(pkg);
    void this.router.navigateByUrl('/checkout');
  }

  buyAnotherPackage(): void {
    document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  connectWithVoucher(): void {
    const code = this.voucherCode.trim().toLowerCase();

    if (!this.hotspotLogin.canSubmit()) {
      this.voucherError.set('Unganisha kwanza kwenye Bitech WiFi ili kutumia voucher.');
      return;
    }
    if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/.test(code)) {
      this.voucherError.set('Voucher lazima iwe code halali ya herufi/namba 8.');
      return;
    }

    this.voucherError.set(null);
    this.voucherChecking.set(true);
    this.portal.validateVoucher(code).subscribe({
      next: (result) => {
        this.voucherChecking.set(false);
        if (result.status === 'expired' && result.expired_voucher) {
          this.enteredExpiredVoucher.set(result.expired_voucher);
          this.voucherError.set(null);
          return;
        }
        if (result.status === 'invalid') {
          this.voucherError.set('Code ya voucher si sahihi au voucher haipo.');
          return;
        }
        this.hotspotLogin.submitHotspotLogin(code, code);
      },
      error: (err: unknown) => {
        this.voucherChecking.set(false);
        this.voucherError.set(
          err instanceof AppError ? err.message : 'Imeshindikana kuhakiki voucher. Jaribu tena.',
        );
      },
    });
  }

  private describeHotspotError(error: string): string {
    const message = error.toLowerCase();
    if (message.includes('invalid') || message.includes('password') || message.includes('user')) {
      return 'Code ya voucher si sahihi au voucher haipo.';
    }
    if (message.includes('mac') || message.includes('bound')) {
      return 'Voucher hii haifanyi kazi kwenye kifaa hiki.';
    }
    return `MikroTik imekataa voucher: ${error}`;
  }

  refreshHealth(): void {
    this.healthLoading.set(true);
    this.healthError.set(null);
    this.api.getHealthReady().subscribe({
      next: (data) => {
        this.ready.set(data);
        this.healthLoading.set(false);
      },
      error: (err: unknown) => {
        this.healthError.set(err instanceof AppError ? err.message : 'API haipatikani.');
        this.ready.set(null);
        this.healthLoading.set(false);
      },
    });
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} dakika`;
    if (minutes % 1440 === 0) {
      const days = minutes / 1440;
      return days === 1 ? 'Siku 1' : `Siku ${days}`;
    }
    if (minutes % 60 === 0) return `Masaa ${minutes / 60}`;
    return `${minutes} dakika`;
  }

  private loadPackagesForNode(nodeId: string): void {
    this.packagesLoading.set(true);
    this.packagesError.set(null);
    this.portal.loadNodePackages(nodeId).subscribe({
      next: (data) => {
        this.packages.set(data.packages);
        this.packagesLoading.set(false);
      },
      error: (err: unknown) => {
        this.packagesError.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.packagesLoading.set(false);
      },
    });
  }

  private loadGiftSites(): void {
    this.sitesLoading.set(true);
    this.sitesError.set(null);
    this.portal.listSites().subscribe({
      next: (sites) => {
        this.sites.set(sites);
        this.sitesLoading.set(false);
      },
      error: (err: unknown) => {
        this.sitesError.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.sitesLoading.set(false);
      },
    });
  }
}

export function automaticGiftNode(nodes: PublicGiftNode[]): PublicGiftNode | null {
  return nodes.length === 1 ? nodes[0] : null;
}
