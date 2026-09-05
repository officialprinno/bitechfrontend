import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiClient } from '../../../core/api/api-client';
import { PortalSessionService } from '../../../core/portal/portal-session.service';
import { HotspotLoginService } from '../../../core/portal/hotspot-login.service';
import { captureHotspotContext } from '../../../core/portal/hotspot-context';
import { PortalHomeComponent, automaticGiftNode } from './portal-home.component';

describe('PortalHomeComponent captured hotspot bootstrap', () => {
  afterEach(() => sessionStorage.removeItem('bitech.hotspot.context'));

  it('sends captured values to the API after navigation has removed all query params', () => {
    captureHotspotContext({
      location: { href: 'https://bitech.rocksolutions.co.tz/?node_id=buhongwa-01&mac=CE:0B:2D:3E:41:45&ip=192.168.88.70&link-login=http://hotspot.local/login&link-orig=http://example.com/' } as Location,
      sessionStorage,
      history: { replaceState: () => undefined } as unknown as History,
    });
    const createSession = jasmine.createSpy('createSession').and.returnValue(of({
      node: { node_identifier: 'buhongwa-01' },
    }));
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      { provide: PortalSessionService, useValue: {
        session: () => null, createSession, loadNodePackages: () => of({ packages: [] }),
      } },
      { provide: HotspotLoginService, useValue: {} },
      { provide: ApiClient, useValue: { getHealthReady: () => of({}) } },
    ] });
    const component = TestBed.runInInjectionContext(() => new PortalHomeComponent());
    component.ngOnInit();
    expect(createSession).toHaveBeenCalledWith(jasmine.objectContaining({
      node_id: 'buhongwa-01', mac: 'CE:0B:2D:3E:41:45', ip: '192.168.88.70',
      link_login: 'http://hotspot.local/login', link_orig: 'http://example.com/', intent: 'self',
    }));
  });
});

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
    expect(fixture.nativeElement.querySelector('#voucher-code')).not.toBeNull();
  });

  it('returns cleanly to the current package selection', () => {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((item: unknown) => (item as HTMLElement).textContent?.includes('Nunua kifurushi')) as HTMLButtonElement;
    button.click();
    expect(scrolled).toBeTrue();
  });

  it('focuses an empty replacement field without discarding the expired session', () => {
    const input = fixture.nativeElement.querySelector('#voucher-code') as HTMLInputElement;
    input.scrollIntoView = () => undefined;
    fixture.componentInstance.voucherCode = 'old-code';
    fixture.componentInstance.focusVoucher();
    fixture.detectChanges();
    expect(fixture.componentInstance.voucherCode).toBe('');
    expect(document.activeElement).toBe(input);
    expect(fixture.componentInstance.session()?.session_token).toBe('signed');
    expect(fixture.nativeElement.textContent).not.toContain('Badilisha site');
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
    expect(text).toContain('Nunua kifurushi');
    expect(login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#voucher-code')).not.toBeNull();

    // A customer can replace an expired code with an agent voucher in the same session.
    spyOn(portal, 'validateVoucher').and.returnValue(of({ status: 'valid' } as any));
    fixture.componentInstance.voucherCode = 'AB3K9M2X';
    fixture.componentInstance.connectWithVoucher();
    expect(login).toHaveBeenCalledOnceWith('ab3k9m2x', 'ab3k9m2x');
  });
});
