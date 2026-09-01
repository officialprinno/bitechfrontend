import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiClient } from '../../../core/api/api-client';
import { PortalSessionService } from '../../../core/portal/portal-session.service';
import { HotspotLoginService } from '../../../core/portal/hotspot-login.service';
import { PortalHomeComponent, automaticGiftNode } from './portal-home.component';

describe('automaticGiftNode', () => {
  const node = (id: string) => ({ id, node_identifier: id, display_name: id });

  it('auto-selects the real API node when exactly one exists', () => {
    expect(automaticGiftNode([node('warehouse-ap')])?.node_identifier).toBe('warehouse-ap');
  });

  it('requires explicit selection when multiple nodes exist', () => {
    expect(automaticGiftNode([node('mwz-main-router'), node('office-hotspot')])).toBeNull();
  });

  it('blocks automatic selection when no nodes exist', () => {
    expect(automaticGiftNode([])).toBeNull();
  });
});

describe('PortalHomeComponent expired voucher experience', () => {
  let fixture: ComponentFixture<PortalHomeComponent>;
  let scrolled = false;
  const session = {
    session_token: 'signed',
    site: { id: 'site-1', name: 'Buhongwa', slug: 'buhongwa' },
    node: { id: 'node-1', node_identifier: 'buhongwa-01', health_status: 'online', is_online: true },
    mac: 'CE:0B:2D:3E:41:45', ip: null, link_login: 'http://192.168.88.1/login',
    link_orig: '', hotspot_error: '', can_purchase_self: true, mode: 'captive' as const,
    voucher_status: 'expired' as const,
    expired_voucher: {
      code: 'ujh6mzkb', package_name: '2 Hours',
      validity_started_at: '2026-08-30T13:04:00Z', expires_at: '2026-08-30T15:04:00Z',
      device_name: 'innocent-s-A14', mac_address: 'CE:0B:2D:3E:41:45',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalHomeComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: PortalSessionService, useValue: {
          session: () => session,
          refreshSession: () => of(session),
          loadNodePackages: () => of({ packages: [] }),
        } },
        { provide: HotspotLoginService, useValue: {} },
        { provide: ApiClient, useValue: { getHealthReady: () => of({ checks: { database: { status: 'ok' } } }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PortalHomeComponent);
    fixture.detectChanges();
    const packages = fixture.nativeElement.querySelector('#packages') as HTMLElement;
    Object.defineProperty(packages, 'scrollIntoView', { value: () => { scrolled = true; } });
  });

  it('renders safe expired details in Tanzania local time and no internal credentials', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Muda wa Voucher Umeisha');
    expect(text).toContain('2 Hours');
    expect(text).toContain('30 Aug 2026, 4:04 PM');
    expect(text).toContain('30 Aug 2026, 6:04 PM');
    expect(text).toContain('innocent-s-A14');
    expect(text).toContain('ujh6mzkb');
    expect(text).not.toContain('must-never-be-returned');
    expect(text).not.toContain('bitech-voucher:');
    expect(fixture.nativeElement.querySelector('#voucher-code')).toBeNull();
  });

  it('returns cleanly to the current package selection', () => {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((item: unknown) => (item as HTMLElement).textContent?.includes('Nunua Package')) as HTMLButtonElement;
    button.click();
    expect(scrolled).toBeTrue();
  });
});

describe('PortalHomeComponent entered expired voucher', () => {
  it('shows the full expired explanation instead of submitting ujh6mzkb to MikroTik', async () => {
    const activeSession = {
      session_token: 'signed',
      site: { id: 'site-1', name: 'Buhongwa', slug: 'buhongwa' },
      node: { id: 'node-1', node_identifier: 'buhongwa-01', health_status: 'online', is_online: true },
      mac: 'CE:0B:2D:3E:41:45', ip: null, link_login: 'http://192.168.88.1/login',
      link_orig: '', hotspot_error: '', can_purchase_self: true, mode: 'captive' as const,
      voucher_status: null, expired_voucher: null,
    };
    const login = jasmine.createSpy('submitHotspotLogin');
    const portal = {
      session: () => activeSession,
      refreshSession: () => of(activeSession),
      loadNodePackages: () => of({ packages: [] }),
      validateVoucher: () => of({
        status: 'expired' as const,
        expired_voucher: {
          code: 'ujh6mzkb', package_name: '2 Hours',
          validity_started_at: '2026-08-30T13:04:00Z', expires_at: '2026-08-30T15:04:00Z',
          device_name: 'innocent-s-A14', mac_address: 'CE:0B:2D:3E:41:45',
        },
      }),
    };
    await TestBed.configureTestingModule({
      imports: [PortalHomeComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: PortalSessionService, useValue: portal },
        { provide: HotspotLoginService, useValue: { canSubmit: () => true, submitHotspotLogin: login } },
        { provide: ApiClient, useValue: { getHealthReady: () => of({ checks: { database: { status: 'ok' } } }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PortalHomeComponent);
    fixture.detectChanges();
    fixture.componentInstance.voucherCode = 'ujh6mzkb';
    fixture.componentInstance.connectWithVoucher();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Muda wa Voucher Umeisha');
    expect(text).toContain('ujh6mzkb');
    expect(text).toContain('Nunua Package');
    expect(login).not.toHaveBeenCalled();
  });
});
