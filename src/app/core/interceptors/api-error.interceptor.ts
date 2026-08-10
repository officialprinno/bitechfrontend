import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiEnvelope } from '../models/api.model';
import { AppError } from '../models/app-error';

function messageFromBody(err: HttpErrorResponse): string | null {
  const body = err.error;
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' && body.trim() ? body : null;
  }

  const envelope = body as ApiEnvelope<unknown> & { detail?: unknown; message?: unknown };
  if (envelope.error?.message) {
    return envelope.error.message;
  }
  if (typeof envelope.detail === 'string') {
    return envelope.detail;
  }
  if (Array.isArray(envelope.detail) && envelope.detail.length) {
    return String(envelope.detail[0]);
  }
  if (typeof envelope.message === 'string') {
    return envelope.message;
  }
  return null;
}

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      const body = err.error as ApiEnvelope<unknown> | null;
      const requestId =
        (err.headers.get('X-Request-Id') || body?.meta?.request_id) ?? null;
      const message =
        messageFromBody(err) ||
        (err.status === 401
          ? 'Session imeisha — ingia tena.'
          : err.message || 'Hitilafu ya mtandao.');

      if (body && typeof body === 'object' && body.error) {
        const apiError = body.error;
        return throwError(
          () =>
            new AppError({
              message: apiError.message || message,
              code: apiError.code || (err.status === 401 ? 'unauthorized' : 'api_error'),
              details: apiError.details,
              status: err.status,
              requestId,
            }),
        );
      }

      return throwError(
        () =>
          new AppError({
            message,
            code: err.status === 401 ? 'unauthorized' : 'network_error',
            status: err.status,
            requestId,
          }),
      );
    }),
  );
};
