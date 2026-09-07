import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppError } from '../../../core/models/app-error';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient } from '../../../core/api/api-client';
import { AdminNodesComponent } from './admin-nodes.component';

describe('AdminNodesComponent remote management', () => {
  const node = { id: 'node-1', site: 'site-1', site_name: 'Buhongwa', node_identifier: 'buhongwa-01', display_name: 'Buhongwa router', mikrotik_host: '10.77.0.11', api_port: 8728, use_ssl: false, is_active: true, health_status: 'online' as const, last_health_check_at: null, remote_management: { permitted: true, available: true } };
  let component: AdminNodesComponent;
  let api: jasmine.SpyObj<ApiClient>;
  beforeEach(() => {
    api = jasmine.createSpyObj('ApiClient', ['getPage', 'post']);
    api.getPage.and.returnValue(of({ rows: [node], count: 1, page: 1, pageSize: 100, next: false }));
    TestBed.configureTestingModule({ providers: [
      { provide: ApiClient, useValue: api },
      { provide: AuthService, useValue: { isSuperAdmin: () => true } },
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
    ] });
    component = TestBed.runInInjectionContext(() => new AdminNodesComponent());
  });
  it('requests a server-resolved session without router credentials or host', () => {
    const replace = jasmine.createSpy('replace');
    spyOn(window, 'open').and.returnValue({ opener: window, location: { replace }, close: () => {} } as unknown as Window);
    api.post.and.returnValue(of({ session_id: 'session', management_url: 'https://session.routers.example.test/_bitech/start#token' }));
    component.openManagement(node);
    expect(api.post).toHaveBeenCalledWith('/router-management/nodes/node-1/sessions/', {});
    expect(replace).toHaveBeenCalledWith('https://session.routers.example.test/_bitech/start#token');
    expect(component.openingId()).toBeNull();
  });
  it('does not issue a session when popup is blocked or node inactive', () => {
    spyOn(window, 'open').and.returnValue(null);
    component.openManagement(node);
    component.openManagement({ ...node, is_active: false });
    expect(api.post).not.toHaveBeenCalled();
    expect(component.managementMsg()[node.id]).toContain('pop-ups');
  });
  it('closes the blank tab and exposes a safe failure message', () => {
    const close = jasmine.createSpy('close');
    spyOn(window, 'open').and.returnValue({ opener: null, close } as unknown as Window);
    api.post.and.returnValue(throwError(() => new Error('private internal failure')));
    component.openManagement(node);
    expect(close).toHaveBeenCalled();
    expect(component.managementMsg()[node.id]).toBe('Unable to create a management session.');
  });
  it('loads pagination and clears a previous fetch error', () => {
    component.error.set('previous error');
    component.ngOnInit();
    expect(component.error()).toBeNull();
    expect(component.nodes()).toEqual([node]);
    component.search.set('missing');
    expect(component.filteredNodes()).toEqual([]);
  });
  it('does not open a tab for missing permission or an ineligible router', () => {
    const open = spyOn(window, 'open');
    component.openManagement({ ...node, remote_management: { permitted: false, available: false } });
    component.openManagement({ ...node, remote_management: { permitted: true, available: false } });
    expect(open).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('rejects a URL whose origin is not bound to the issued session', () => {
    const close = jasmine.createSpy('close');
    const replace = jasmine.createSpy('replace');
    spyOn(window, 'open').and.returnValue({ opener: null, close, location: { replace } } as unknown as Window);
    api.post.and.returnValue(of({ session_id: 'session', management_url: 'https://other.routers.test/_bitech/start#secret' }));
    component.openManagement(node);
    expect(close).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it('maps forbidden API responses without exposing internal server details', () => {
    spyOn(window, 'open').and.returnValue({ opener: null, close: () => {} } as unknown as Window);
    api.post.and.returnValue(throwError(() => new AppError({ status: 403, message: 'SECRET internal address' })));
    component.openManagement(node);
    expect(component.managementMsg()[node.id]).toContain('permission');
    expect(component.managementMsg()[node.id]).not.toContain('SECRET');
  });
});

describe('Router management action visibility', () => {
  it('uses server permission and eligibility flags and hides private addresses', async () => {
    const node = { id: 'n', node_identifier: 'main', display_name: 'Main', site_name: 'Site', is_active: true, health_status: 'online', mikrotik_host: '10.77.0.11', remote_management: { permitted: false, available: false } };
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'routers', component: AdminNodesComponent }]),
      { provide: ApiClient, useValue: { getPage: () => of({ rows: [node], next: false }) } },
      { provide: AuthService, useValue: { isSuperAdmin: () => false } },
    ] });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/routers', AdminNodesComponent);
    const launchButtons = () => Array.from(harness.routeNativeElement!.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Remote Management') as HTMLButtonElement[];
    expect(launchButtons().length).toBe(0);
    expect(harness.routeNativeElement!.textContent).not.toContain('10.77.0.11');
    component.nodes.update(rows => rows.map(row => ({ ...row, remote_management: { permitted: true, available: false } })));
    harness.detectChanges();
    expect(launchButtons()[0].disabled).toBeTrue();
    component.nodes.update(rows => rows.map(row => ({ ...row, remote_management: { permitted: true, available: true } })));
    harness.detectChanges();
    expect(launchButtons()[0].disabled).toBeFalse();
  });
});
