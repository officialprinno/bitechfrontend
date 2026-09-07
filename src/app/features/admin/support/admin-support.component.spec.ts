import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { AdminSupportComponent } from './admin-support.component';

describe('Voucher inventory dashboard drill-down', () => {
  it('loads copied lifecycle filters immediately, paginates, and clears the entire scope', async () => {
    const get = jasmine.createSpy().and.returnValue(of({ count: 55, results: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'support', component: AdminSupportComponent }]),
        { provide: ApiClient, useValue: { get } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/support?lifecycle=expired&range=7d&page=2',
      AdminSupportComponent,
    );
    expect(get).toHaveBeenCalledWith(
      '/admin/vouchers/',
      jasmine.objectContaining({ lifecycle: 'expired', range: '7d', page: '2', page_size: 25 }),
    );
    expect(component.source()).toBe('all');
    component.move(1);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('page=3');
    component.clearAndRecent();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/support');
    expect(get.calls.mostRecent().args[1]).not.toEqual(
      jasmine.objectContaining({ lifecycle: 'expired' }),
    );
  });
});
