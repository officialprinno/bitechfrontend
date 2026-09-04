import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PaymentNavigationService {
  private readonly document = inject(DOCUMENT);

  isSafeProviderUrl(value?: string): boolean {
    if (!value) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  redirect(url: string): void {
    this.document.defaultView?.location.assign(url);
  }
}
