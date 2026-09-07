import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, finalize, shareReplay, take, tap, throwError } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { AuthUser, LoginResponse, RefreshResponse } from './auth.models';

const ACCESS_KEY = 'bitech.access';
const REFRESH_KEY = 'bitech.refresh';
const USER_KEY = 'bitech.user';
const REVIEW_KEY = 'bitech.session-review-at';
const SESSION_HOUR = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(this.readUser());
  private readonly accessSignal = signal<string | null>(sessionStorage.getItem(ACCESS_KEY));
  private refreshInFlight: Observable<RefreshResponse> | null = null;
  private sessionVersion = 0;

  readonly user = this.userSignal.asReadonly();
  readonly accessToken = this.accessSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessSignal());
  readonly sessionLocked = signal(false);
  readonly continuing = signal(false);
  readonly sessionError = signal('');
  private readonly decision = new Subject<boolean>();

  constructor() {
    if (this.isAuthenticated() && !sessionStorage.getItem(REVIEW_KEY)) this.resetReview();
    this.checkSession();
    const timer = window.setInterval(() => this.checkSession(), 1000);
    const check = () => this.checkSession();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    });
  }

  checkSession(): void {
    if (!this.isAuthenticated()) return;
    const deadline = Number(sessionStorage.getItem(REVIEW_KEY));
    if (!Number.isFinite(deadline) || deadline <= Date.now()) this.sessionLocked.set(true);
  }

  waitForDecision(): Observable<boolean> { return this.decision.pipe(take(1)); }

  continueSession(): void {
    if (this.continuing() || !this.sessionLocked()) return;
    this.continuing.set(true);
    this.sessionError.set('');
    this.refresh().pipe(finalize(() => this.continuing.set(false))).subscribe({
      next: () => {
        this.resetReview();
        this.sessionLocked.set(false);
        this.decision.next(true);
      },
      error: () => this.sessionError.set('Imeshindikana kuendelea. Jaribu tena au toka uingie upya.'),
    });
  }

  private resetReview(): void {
    sessionStorage.setItem(REVIEW_KEY, String(Date.now() + SESSION_HOUR));
  }
  readonly isSuperAdmin = computed(() => this.userSignal()?.role === 'superadmin');
  readonly isAgent = computed(() => this.userSignal()?.kind === 'agent' || this.userSignal()?.role === 'agent');
  readonly isAdmin = computed(() => this.userSignal()?.kind === 'admin' || (!!this.userSignal() && !this.isAgent()));

  hasRefreshToken(): boolean {
    return !!sessionStorage.getItem(REFRESH_KEY);
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse, { username: string; password: string }>('/auth/login/', {
        username,
        password,
      })
      .pipe(tap((res) => this.persistSession(res.access, res.refresh, res.user)));
  }

  agentLogin(username: string, password: string): Observable<LoginResponse> {
    return this.login(username, password);
  }

  refresh(): Observable<RefreshResponse> {
    const refresh = sessionStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      return throwError(() => new Error('Hakuna refresh token.'));
    }
    if (!this.refreshInFlight) {
      const version = this.sessionVersion;
      this.refreshInFlight = this.api
        .post<RefreshResponse, { refresh: string }>('/auth/refresh/', { refresh })
        .pipe(
          tap((res) => {
            if (version !== this.sessionVersion) throw new Error('Session ended.');
            sessionStorage.setItem(ACCESS_KEY, res.access);
            this.accessSignal.set(res.access);
            if (res.refresh) {
              sessionStorage.setItem(REFRESH_KEY, res.refresh);
            }
          }),
          finalize(() => {
            this.refreshInFlight = null;
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.refreshInFlight;
  }

  logout(redirect = true): void {
    this.sessionVersion++;
    this.decision.next(false);
    this.sessionLocked.set(false);
    this.sessionError.set('');
    sessionStorage.removeItem(REVIEW_KEY);
    this.refreshInFlight = null;
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.accessSignal.set(null);
    this.userSignal.set(null);
    if (redirect) {
      void this.router.navigateByUrl('/login');
    }
  }

  homeUrl(): '/admin' | '/agent' {
    return this.isAgent() ? '/agent' : '/admin';
  }

  private persistSession(access: string, refresh: string, user: AuthUser): void {
    this.sessionVersion++;
    this.resetReview();
    this.sessionLocked.set(false);
    sessionStorage.setItem(ACCESS_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    this.accessSignal.set(access);
    this.userSignal.set(user);
  }

  private readUser(): AuthUser | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as AuthUser;
      if (!user.kind || !user.role || !Array.isArray(user.capabilities)) return null;
      return user;
    } catch {
      return null;
    }
  }
}
