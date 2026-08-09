import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiEnvelope } from '../models/api.model';
import { AppError } from '../models/app-error';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      const body = err.error as ApiEnvelope<unknown> | null;
      const requestId =
        (err.headers.get('X-Request-Id') || body?.meta?.request_id) ?? null;

      if (body && typeof body === 'object' && body.error) {
        const apiError = body.error;
        return throwError(
          () =>
            new AppError({
              message: apiError.message,
              code: apiError.code,
              details: apiError.details,
              status: err.status,
              requestId,
            }),
        );
      }

      return throwError(
        () =>
          new AppError({
            message: err.message || 'Hitilafu ya mtandao.',
            code: 'network_error',
            status: err.status,
            requestId,
          }),
      );
    }),
  );
};
