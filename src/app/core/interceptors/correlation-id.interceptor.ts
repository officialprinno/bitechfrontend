import { HttpInterceptorFn } from '@angular/common/http';

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const requestId =
    globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return next(
    req.clone({
      setHeaders: {
        'X-Request-Id': requestId,
      },
    }),
  );
};
