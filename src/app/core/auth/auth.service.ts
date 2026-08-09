import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { AuthUser, LoginResponse, RefreshResponse } from './auth.models';

const ACCESS_KEY = 'bitech.access';
const REFRESH_KEY = 'bitech.refresh';
const USER_KEY = 'bitech.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthUser | null>(this.readUser());
  private readonly accessSignal = signal<string | null>(sessionStorage.getItem(ACCESS_KEY));

  readonly user = this.userSignal.asReadonly();
  readonly accessToken = this.accessSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessSignal());
  readonly isSuperAdmin = computed(() => this.userSignal()?.role === 'superadmin');
  readonly isAgent = computed(() => this.userSignal()?.kind === 'agent' || this.userSignal()?.role === 'agent');
  readonly isAdmin = computed(() => this.userSignal()?.kind === 'admin' || (!!this.userSignal() && !this.isAgent()));

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse, { username: string; password: string }>('/auth/login/', {
        username,
        password,
      })
      .pipe(tap((res) => this.persistSession(res.access, res.refresh, this.normalizeUser(res.user, 'admin'))));
  }

  agentLogin(username: string, password: string): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse, { username: string; password: string }>('/auth/agent/login/', {
        username,
        password,
      })
      .pipe(tap((res) => this.persistSession(res.access, res.refresh, this.normalizeUser(res.user, 'agent'))));
  }

  refresh(): Observable<RefreshResponse> {
    const refresh = sessionStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      throw new Error('Hakuna refresh token.');
    }
    return this.api.post<RefreshResponse, { refresh: string }>('/auth/refresh/', { refresh }).pipe(
      tap((res) => {
        sessionStorage.setItem(ACCESS_KEY, res.access);
        this.accessSignal.set(res.access);
        if (res.refresh) {
          sessionStorage.setItem(REFRESH_KEY, res.refresh);
        }
      }),
    );
  }

  logout(redirect = true): void {
    const wasAgent = this.isAgent();
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.accessSignal.set(null);
    this.userSignal.set(null);
    if (redirect) {
      void this.router.navigateByUrl(wasAgent ? '/agent/login' : '/admin/login');
    }
  }

  private normalizeUser(user: AuthUser, fallbackKind: 'admin' | 'agent'): AuthUser {
    return {
      ...user,
      kind: user.kind ?? fallbackKind,
      role: user.role ?? (fallbackKind === 'agent' ? 'agent' : 'site_manager'),
    };
  }

  private persistSession(access: string, refresh: string, user: AuthUser): void {
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
      if (!user.kind) {
        user.kind = user.role === 'agent' ? 'agent' : 'admin';
      }
      return user;
    } catch {
      return null;
    }
  }
}
