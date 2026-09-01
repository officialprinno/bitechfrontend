import { Injectable, inject } from '@angular/core';

import { PortalSessionService } from './portal-session.service';

@Injectable({ providedIn: 'root' })
export class HotspotLoginService {
  private readonly portal = inject(PortalSessionService);

  canSubmit(): boolean {
    return !!this.portal.session()?.link_login?.trim();
  }

  submitHotspotLogin(username: string, password: string): void {
    const session = this.portal.session();
    const action = session?.link_login?.trim() || '';
    if (!action) {
      throw new Error('Fungua ukurasa huu kupitia WiFi ya hotspot.');
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    form.acceptCharset = 'UTF-8';

    this.addHiddenField(form, 'username', username);
    this.addHiddenField(form, 'password', password);
    this.addHiddenField(form, 'dst', session?.link_orig || '');
    this.addHiddenField(form, 'popup', 'false');

    document.body.appendChild(form);
    form.submit();
  }

  private addHiddenField(form: HTMLFormElement, name: string, value: string): void {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
}
