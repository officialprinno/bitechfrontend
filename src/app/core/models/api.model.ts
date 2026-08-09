export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiMeta {
  request_id?: string | null;
  pagination?: {
    count: number;
    page: number;
    page_size: number;
    next: string | null;
    previous: string | null;
  };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: ApiErrorBody | null;
  meta: ApiMeta;
}

export interface HealthLiveData {
  status: string;
  service: string;
}

export interface HealthReadyData {
  status: string;
  checks: {
    database: { status: string; detail?: string };
    redis: { status: string; detail?: string };
  };
}
