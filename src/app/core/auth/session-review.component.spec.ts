import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { SessionReviewComponent } from './session-review.component';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Hourly session review', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.setItem('bitech.access', 'old-access');
    sessionStorage.setItem('bitech.refresh', 'refresh-token');
    sessionStorage.setItem('bitech.session-review-at', String(Date.now() + 3600000));
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    ['bitech.access', 'bitech.refresh', 'bitech.user', 'bitech.session-review-at'].forEach(k => sessionStorage.removeItem(k));
  });
  function expire() {
    sessionStorage.setItem('bitech.session-review-at', String(Date.now() - 1));
    auth.checkSession();
  }
  it('locks at one hour and renders a non-dismissible modal', () => {
    auth.checkSession();
    expect(auth.sessionLocked()).toBeFalse();
    expire();
    const fixture = TestBed.createComponent(SessionReviewComponent);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    expect(dialog.matches(':modal')).toBeTrue();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBeTrue();
    expect(auth.sessionLocked()).toBeTrue();
  });
  it('blocks API requests until Continue successfully refreshes and grants another hour', () => {
    expire();
    TestBed.inject(HttpClient).get('/api/v1/admin/nodes/').subscribe();
    http.expectNone('/api/v1/admin/nodes/');
    auth.continueSession();
    expect(auth.sessionLocked()).toBeTrue();
    http.expectOne(r => r.url.endsWith('/auth/refresh/')).flush({ success: true, data: { access: 'new-access', refresh: 'new-refresh' } });
    const resumed = http.expectOne('/api/v1/admin/nodes/');
    expect(resumed.request.headers.get('Authorization')).toBe('Bearer new-access');
    resumed.flush({});
    expect(auth.sessionLocked()).toBeFalse();
    expect(Number(sessionStorage.getItem('bitech.session-review-at'))).toBeGreaterThan(Date.now() + 3590000);
  });
  it('keeps the screen locked if continuation fails', () => {
    expire();
    auth.continueSession();
    http.expectOne(r => r.url.endsWith('/auth/refresh/')).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.sessionLocked()).toBeTrue();
    expect(auth.continuing()).toBeFalse();
    expect(auth.sessionError()).toBeTruthy();
  });
  it('cancels waiting requests and clears session when the user logs out', () => {
    expire();
    let failed = false;
    TestBed.inject(HttpClient).post('/api/v1/admin/nodes/', {}).subscribe({ error: () => failed = true });
    auth.logout(false);
    expect(failed).toBeTrue();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(sessionStorage.getItem('bitech.session-review-at')).toBeNull();
    http.expectNone('/api/v1/admin/nodes/');
  });
  it('does not extend the review deadline during automatic token refresh', () => {
    const deadline = sessionStorage.getItem('bitech.session-review-at');
    auth.refresh().subscribe();
    http.expectOne(r => r.url.endsWith('/auth/refresh/')).flush({ success: true, data: { access: 'renewed' } });
    expect(sessionStorage.getItem('bitech.session-review-at')).toBe(deadline);
  });
});
