import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ManagementComponent } from './management.component';

describe('Admin management workflow', () => {
  let api: { getPage: jasmine.Spy; get: jasmine.Spy; post: jasmine.Spy; patch: jasmine.Spy };
  beforeEach(() => {
    api = {
      getPage: jasmine
        .createSpy()
        .and.returnValue(of({ rows: [], count: 51, page: 1, pageSize: 25, next: true })),
      get: jasmine.createSpy().and.returnValue(of({})),
      post: jasmine.createSpy().and.returnValue(of({})),
      patch: jasmine.createSpy().and.returnValue(of({})),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'nodes', component: ManagementComponent, data: { resource: 'nodes' } },
          { path: 'customers', component: ManagementComponent, data: { resource: 'customers' } },
          { path: 'users', component: ManagementComponent, data: { resource: 'users' } },
          {
            path: 'assignments',
            component: ManagementComponent,
            data: { resource: 'agent-assignments' },
          },
        ]),
        { provide: ApiClient, useValue: api },
      ],
    });
  });
  it('opens Edit from the node row and saves only editable fields without replacing a blank password', async () => {
    const node = { id: 'node-1', display_name: 'Main router', node_identifier: 'main-01', site: 'site-1', site_name: 'Main site', mikrotik_host: '10.77.0.11', api_username: 'operator', api_port: 8728, use_ssl: false, is_active: true, health_status: 'online' };
    api.getPage.and.callFake((path: string) => of({ rows: path === '/admin/sites/' ? [{ id: 'site-1', name: 'Main site' }] : [node], count: 1, page: 1, pageSize: 25, next: false }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/nodes', ManagementComponent);
    const edit = Array.from(harness.routeNativeElement!.querySelectorAll('tbody button')).find(b => b.textContent?.trim() === 'Edit') as HTMLButtonElement;
    edit.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(page.editor).toBeTrue();
    expect(page.detail()).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#edit-heading')?.textContent).toContain('Edit node');
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('edit-heading');
    const name = harness.routeNativeElement!.querySelector('input[name="display_name"]') as HTMLInputElement;
    name.value = 'Updated router';
    name.dispatchEvent(new Event('input'));
    harness.detectChanges();
    const form = harness.routeNativeElement!.querySelector('.editor form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(api.patch).toHaveBeenCalledWith('/admin/nodes/node-1/', jasmine.objectContaining({ display_name: 'Updated router', site: 'site-1' }));
    const body = api.patch.calls.mostRecent().args[1];
    expect(body.api_password).toBeUndefined();
    expect(body.health_status).toBeUndefined();
    expect(page.editor).toBeFalse();
  });

  it('switches from Edit to read-only Details and back without overlapping panels', async () => {
    const node = { id: 'node-1', node_identifier: 'main-01', display_name: 'Main router' };
    api.getPage.and.returnValue(of({ rows: [node], count: 1, page: 1, pageSize: 25, next: false }));
    api.get.and.returnValue(of(node));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/nodes', ManagementComponent);
    page.edit(node);
    harness.detectChanges();
    const details = Array.from(harness.routeNativeElement!.querySelectorAll('tbody button')).find(b => b.textContent?.trim() === 'Details') as HTMLButtonElement;
    details.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(page.editor).toBeFalse();
    expect(page.detail()?.['id']).toBe('node-1');
    expect(harness.routeNativeElement!.querySelector('.editor input')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#detail-heading')?.textContent).toContain('Node details');
    expect(api.patch).not.toHaveBeenCalled();
    page.edit(node);
    harness.detectChanges();
    expect(page.detail()).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#detail-heading')).toBeNull();
    expect(page.editingId).toBe('node-1');
    page.open(node);
    harness.detectChanges();
    expect(page.editor).toBeFalse();
    expect(page.detail()?.['id']).toBe('node-1');
  });
  it('restores filters from copied URLs and sends server pagination', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/customers?search=1234&page=2&from=2026-01-01',
      ManagementComponent,
    );
    expect(page.search).toBe('1234');
    expect(api.getPage).toHaveBeenCalledWith(
      '/admin/diagnostics/customers/',
      jasmine.objectContaining({ search: '1234', page: '2', page_size: 25, from: '2026-01-01' }),
    );
    page.search = '5678';
    page.apply();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('search=5678');
    expect(TestBed.inject(Router).url).toContain('page=1');
  });
  it('does not mutate until the operator confirms a reason', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/users', ManagementComponent);
    page.ask({ id: 5, username: 'operator' }, 'disable');
    page.confirm();
    expect(api.post).not.toHaveBeenCalled();
    page.reason = 'Account no longer required';
    page.confirm();
    expect(api.post).toHaveBeenCalledWith(
      '/admin/users/5/actions/',
      jasmine.objectContaining({ action: 'disable', reason: 'Account no longer required' }),
    );
  });
  it('keeps failed actions reviewable and displays server rejection', async () => {
    api.post.and.returnValue(throwError(() => new Error('Protected account')));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/users', ManagementComponent);
    page.ask({ id: 5 }, 'disable');
    page.reason = 'Business review';
    page.confirm();
    harness.detectChanges();
    expect(page.command).toBe('disable');
    expect(page.saving()).toBeFalse();
    expect(harness.routeNativeElement?.textContent).toContain('Protected account');
  });
  it('preserves the selected agent in assignment filter navigation', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/assignments?agent=abc&status=suspended',
      ManagementComponent,
    );
    page.search = 'Site';
    page.apply();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('agent=abc');
    expect(TestBed.inject(Router).url).toContain('status=suspended');
  });
});
