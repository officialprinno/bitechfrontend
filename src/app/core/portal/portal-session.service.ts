import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import {
  PortalPackage,
  PortalNode,
  PortalVoucherValidation,
  PublicGiftNode,
  PortalSession,
  PortalSite,
  PurchaseType,
} from '../models/portal.model';

const SESSION_KEY = 'bitech.portal.session';

export interface RedirectParams {
  site_id?: string;
  node_id?: string;
  mac?: string;
  ip?: string;
  link_login?: string;
  link_orig?: string;
  hotspot_error?: string;
  /** self | gift; self requires real MikroTik redirect context */
  intent?: PurchaseType;
}

@Injectable({ providedIn: 'root' })
export class PortalSessionService {
  private readonly api = inject(ApiClient);

  private readonly sessionSignal = signal<PortalSession | null>(this.readStored());
  private readonly selectedPackageSignal = signal<PortalPackage | null>(null);
  private readonly purchaseTypeSignal = signal<PurchaseType>('self');

  readonly session = this.sessionSignal.asReadonly();
  readonly selectedPackage = this.selectedPackageSignal.asReadonly();
  readonly purchaseType = this.purchaseTypeSignal.asReadonly();
  readonly canPurchaseSelf = computed(() => !!this.sessionSignal()?.can_purchase_self);
  readonly hasCaptiveContext = computed(() => this.sessionSignal()?.mode === 'captive');

  bootstrapFromQuery(params: RedirectParams): Observable<PortalSession> | null {
    if (!params.node_id) {
      return null;
    }
    return this.createSession(params);
  }

  createSession(params: RedirectParams): Observable<PortalSession> {
    return this.api
      .post<PortalSession, RedirectParams>('/portal/session/', {
        site_id: params.site_id || '',
        node_id: params.node_id || '',
        mac: params.mac || '',
        ip: params.ip || undefined,
        link_login: params.link_login || '',
        link_orig: params.link_orig || '',
        hotspot_error: params.hotspot_error || '',
        intent: params.intent || 'gift',
      })
      .pipe(tap((session) => this.persist(session)));
  }

  /**
   * Re-issue a signed session from the current node context.
   * Used before checkout / on SESSION_EXPIRED so stale sessionStorage tokens don't 401.
   */
  refreshSession(intent?: PurchaseType): Observable<PortalSession> {
    const current = this.sessionSignal();
    if (!current?.node?.node_identifier) {
      throw new Error('Hakuna session ya kusasisha.');
    }
    return this.createSession({
      site_id: current.site.slug || '',
      node_id: current.node.node_identifier,
      mac: current.mac || '',
      ip: current.ip || undefined,
      link_login: current.link_login || '',
      link_orig: current.link_orig || '',
      hotspot_error: '',
      intent: intent || this.purchaseTypeSignal() || 'gift',
    });
  }

  listSites(): Observable<PortalSite[]> {
    return this.api.get<PortalSite[]>('/portal/sites/');
  }

  listSiteNodes(siteSlug: string): Observable<PublicGiftNode[]> {
    return this.api.get<PublicGiftNode[]>(`/portal/sites/${siteSlug}/nodes/`);
  }

  loadNodePackages(nodeIdentifier: string): Observable<{
    site: PortalSite;
    node: PortalNode;
    packages: PortalPackage[];
  }> {
    return this.api.get(`/portal/packages/${nodeIdentifier}/`);
  }

  loadSitePackages(siteSlug: string): Observable<{
    site: PortalSite;
    packages: PortalPackage[];
  }> {
    return this.api.get(`/portal/sites/${siteSlug}/packages/`);
  }

  validateVoucher(code: string): Observable<PortalVoucherValidation> {
    const session = this.sessionSignal();
    if (!session?.session_token) {
      throw new Error('Hakuna session ya WiFi.');
    }
    return this.api.post<PortalVoucherValidation, { session_token: string; code: string }>(
      '/portal/vouchers/validate/',
      { session_token: session.session_token, code },
    );
  }

  selectPackage(pkg: PortalPackage | null): void {
    this.selectedPackageSignal.set(pkg);
  }

  setPurchaseType(type: PurchaseType): void {
    if (type === 'self' && !this.canPurchaseSelf()) {
      this.purchaseTypeSignal.set('gift');
      return;
    }
    this.purchaseTypeSignal.set(type);
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(null);
    this.selectedPackageSignal.set(null);
    this.purchaseTypeSignal.set('self');
  }

  private persist(session: PortalSession): void {
    const current = this.sessionSignal();
    const sameNode = current?.node.node_identifier === session.node.node_identifier;
    const captiveLink = session.link_login || (sameNode ? current?.link_login : '') || '';
    const captiveMac = session.mac || (sameNode ? current?.mac : '') || '';
    const originalDestination = session.link_orig || (sameNode ? current?.link_orig : '') || '';
    const merged: PortalSession = {
      ...session,
      link_login: captiveLink,
      mac: captiveMac,
      link_orig: originalDestination,
      hotspot_error: session.hotspot_error || '',
      ip: session.ip || (sameNode ? current?.ip : null) || null,
      can_purchase_self: session.can_purchase_self || !!captiveLink,
      mode: captiveLink ? 'captive' : session.mode,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    this.sessionSignal.set(merged);
    if (!sameNode) {
      this.selectedPackageSignal.set(null);
    }
    if (!merged.can_purchase_self) {
      this.purchaseTypeSignal.set('gift');
    } else {
      this.purchaseTypeSignal.set('self');
    }
  }

  private readStored(): PortalSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PortalSession;
    } catch {
      return null;
    }
  }
}
