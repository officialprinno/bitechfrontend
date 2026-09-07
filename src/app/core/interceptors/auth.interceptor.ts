import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AppError } from '../models/app-error';

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/agent/login') ||
    url.includes('/auth/refresh')
  );
}

function isUnauthorized(err: unknown): boolean {
  if (err instanceof HttpErrorResponse) {
    return err.status === 401;
  }
  if (err instanceof AppError) {
    return err.status === 401;
  }
  return false;
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Attach JWT; on 401 try refresh once, otherwise logout (session invalid).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  auth.checkSession();
  if (auth.sessionLocked()) {
    return auth.waitForDecision().pipe(switchMap(continued => continued
      ? sendAuthorized(req, next, auth)
      : throwError(() => new Error('Session ended.'))));
  }
  return sendAuthorized(req, next, auth);
};

function sendAuthorized(req: HttpRequest<unknown>, next: HttpHandlerFn, auth: AuthService): Observable<HttpEvent<unknown>> {

  const token = auth.accessToken();
  const authedReq = token ? withBearer(req, token) : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (!isUnauthorized(err) || req.headers.has('X-Auth-Retry')) {
        return throwError(() => err);
      }

      auth.checkSession();
      if (auth.sessionLocked()) {
        return auth.waitForDecision().pipe(switchMap(continued => continued
          ? sendAuthorized(req, next, auth)
          : throwError(() => new Error('Session ended.'))));
      }

      // No session to salvage — clear stale login state.
      if (!auth.hasRefreshToken()) {
        auth.logout();
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        switchMap(() => {
          const nextToken = auth.accessToken();
          if (!nextToken) {
            auth.logout();
            return throwError(() => err);
          }
          return next(
            withBearer(
              req.clone({ setHeaders: { 'X-Auth-Retry': '1' } }),
              nextToken,
            ),
          );
        }),
        catchError((refreshErr: unknown) => {
          auth.logout();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
}
