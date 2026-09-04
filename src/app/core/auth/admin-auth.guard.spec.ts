import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { adminAuthGuard, agentAuthGuard, guestAuthGuard } from './admin-auth.guard';

describe('unified auth guards', () => {
  const auth = {
    isAuthenticated: jasmine.createSpy('isAuthenticated'),
    isAdmin: jasmine.createSpy('isAdmin'),
    isAgent: jasmine.createSpy('isAgent'),
    homeUrl: jasmine.createSpy('homeUrl'),
  };
  const router = { createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((parts) => parts) };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth }, { provide: Router, useValue: router },
    ] });
    auth.isAuthenticated.and.returnValue(false);
    auth.isAdmin.and.returnValue(false);
    auth.isAgent.and.returnValue(false);
    auth.homeUrl.and.returnValue('/admin');
  });

  it('sends unauthenticated protected routes to /login', () => {
    expect(TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never)) as unknown).toEqual(['/login']);
    expect(TestBed.runInInjectionContext(() => agentAuthGuard({} as never, {} as never)) as unknown).toEqual(['/login']);
  });

  it('sends an agent away from admin routes', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.isAgent.and.returnValue(true);
    expect(TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never)) as unknown).toEqual(['/agent']);
  });

  it('sends an authenticated user away from the login page', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.homeUrl.and.returnValue('/agent');
    expect(TestBed.runInInjectionContext(() => guestAuthGuard({} as never, {} as never)) as unknown).toEqual(['/agent']);
  });
});
