import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { HealthReadyData } from '../../../core/models/api.model';
import { PortalPackage, PortalSite } from '../../../core/models/portal.model';
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

      <div class="space-y-3">
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
  private readonly api = inject(ApiClient);

  readonly session = this.portal.session;
  readonly bootstrapping = signal(false);
  readonly packagesLoading = signal(false);
  readonly packagesError = signal<string | null>(null);
  readonly packages = signal<PortalPackage[]>([]);

  readonly sitesLoading = signal(false);
  readonly sitesError = signal<string | null>(null);
  readonly sites = signal<PortalSite[]>([]);

  readonly healthLoading = signal(false);
  readonly healthError = signal<string | null>(null);
  readonly ready = signal<HealthReadyData | null>(null);

  ngOnInit(): void {
    this.refreshHealth();
    const qp = this.route.snapshot.queryParamMap;
    const params = {
      site_id: qp.get('site_id') || undefined,
      node_id: qp.get('node_id') || undefined,
      mac: qp.get('mac') || undefined,
      ip: qp.get('ip') || undefined,
      link_login: qp.get('link-login') || qp.get('link_login') || undefined,
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
    this.portal.clear();
    this.packages.set([]);
    this.packagesError.set(null);
    this.loadGiftSites();
  }

  selectGiftSite(site: PortalSite): void {
    this.packagesLoading.set(true);
    this.packagesError.set(null);
    // Session MUST exist before packages/checkout — otherwise checkout returns 401.
    this.portal
      .createSession({ site_id: site.slug, node_id: `${site.slug}-01`, intent: 'self' })
      .subscribe({
        next: (session) => {
          this.portal.loadSitePackages(site.slug).subscribe({
            next: (data) => {
              this.packages.set(data.packages);
              this.packagesLoading.set(false);
            },
            error: () => {
              // Fallback: node catalog if site packages fail
              this.loadPackagesForNode(session.node.node_identifier);
            },
          });
        },
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
