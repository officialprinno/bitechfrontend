export class AppError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;
  readonly requestId: string | null;

  constructor(options: {
    message: string;
    code?: string;
    details?: unknown;
    status?: number;
    requestId?: string | null;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code ?? 'unknown_error';
    this.details = options.details ?? null;
    this.status = options.status ?? 0;
    this.requestId = options.requestId ?? null;
  }
}
