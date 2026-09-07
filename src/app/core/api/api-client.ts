import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope, HealthLiveData, HealthReadyData } from '../models/api.model';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;
export interface PageResult<T> {
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
  next: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  getPage<T>(path: string, params?: QueryParams): Observable<PageResult<T>> {
    return this.http.get<ApiEnvelope<T[]>>(this.url(path), { params: this.toParams(params) }).pipe(
      map((envelope) => {
        const rows = this.unwrap(envelope);
        const pagination = (
          envelope.meta as
            | {
                pagination?: {
                  count: number;
                  page: number;
                  page_size: number;
                  next: string | null;
                };
              }
            | undefined
        )?.pagination;
        return {
          rows,
          count: pagination?.count ?? rows.length,
          page: pagination?.page ?? 1,
          pageSize: pagination?.page_size ?? rows.length,
          next: !!pagination?.next,
        };
      }),
    );
  }

  get<T>(path: string, params?: QueryParams, headers?: Record<string, string>): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(this.url(path), {
        params: this.toParams(params),
        headers: headers ? new HttpHeaders(headers) : undefined,
      })
      .pipe(map((envelope) => this.unwrap(envelope)));
  }

  post<T, B = unknown>(path: string, body: B, headers?: Record<string, string>): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(this.url(path), body, {
        headers: headers ? new HttpHeaders(headers) : undefined,
      })
      .pipe(map((envelope) => this.unwrap(envelope)));
  }

  patch<T, B = unknown>(path: string, body: B): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(this.url(path), body)
      .pipe(map((envelope) => this.unwrap(envelope)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(this.url(path))
      .pipe(map((envelope) => this.unwrap(envelope)));
  }

  download(path: string): Observable<Blob> {
    return this.http.get(this.url(path), { responseType: 'blob' });
  }

  getHealthLive(): Observable<HealthLiveData> {
    return this.get<HealthLiveData>('/health/');
  }

  getHealthReady(): Observable<HealthReadyData> {
    return this.get<HealthReadyData>('/health/ready/');
  }

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalized}`;
  }

  private toParams(params?: QueryParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  private unwrap<T>(envelope: ApiEnvelope<T>): T {
    if (envelope == null || typeof envelope !== 'object') {
      throw new Error(
        'API ilirudisha jibu lisilo sahihi (si JSON). Hakikisha Django inaendesha kwenye :8000.',
      );
    }
    if (!envelope.success) {
      throw new Error(envelope.error?.message ?? 'Ombi limeshindikana.');
    }
    return envelope.data;
  }
}
