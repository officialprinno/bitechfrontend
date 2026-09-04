import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.isAdmin()) {
    return true;
  }
  if (auth.isAuthenticated() && auth.isAgent()) {
    return router.createUrlTree(['/agent']);
  }
  return router.createUrlTree(['/login']);
};

export const guestAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree([auth.homeUrl()]);
};

export const agentAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.isAgent()) {
    return true;
  }
  if (auth.isAuthenticated() && auth.isAdmin()) {
    return router.createUrlTree(['/admin']);
  }
  return router.createUrlTree(['/login']);
};

export const guestAdminGuard = guestAuthGuard;
export const guestAgentGuard = guestAuthGuard;
