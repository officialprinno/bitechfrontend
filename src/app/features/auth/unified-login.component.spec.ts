import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AppError } from '../../core/models/app-error';
import { UnifiedLoginComponent } from './unified-login.component';

describe('UnifiedLoginComponent', () => {
  const auth = { login: jasmine.createSpy('login') };
  const router = { navigateByUrl: jasmine.createSpy('navigateByUrl') };

  beforeEach(async () => {
    auth.login.calls.reset();
    router.navigateByUrl.calls.reset();
    await TestBed.configureTestingModule({
      imports: [UnifiedLoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('renders one credential form without an admin/agent choice', () => {
    const fixture = TestBed.createComponent(UnifiedLoginComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('BitechWiFi');
    expect(text).toContain('Username');
    expect(text).toContain('Password');
    expect(text).not.toContain('Admin login');
    expect(text).not.toContain('Agent login');
  });

  for (const redirect of ['/agent', '/admin'] as const) {
    it(`uses the server redirect ${redirect}`, () => {
      auth.login.and.returnValue(of({
        access: 'access', refresh: 'refresh', redirect,
        user: { id: 1, username: 'user', email: '', display_name: 'User',
          role: redirect === '/agent' ? 'agent' : 'site_manager',
          kind: redirect === '/agent' ? 'agent' : 'admin', site_ids: [], capabilities: [] },
      }));
      const fixture = TestBed.createComponent(UnifiedLoginComponent);
      const component = fixture.componentInstance;
      component.form.setValue({ username: 'user', password: 'secret' });
      component.submit();
      expect(router.navigateByUrl).toHaveBeenCalledWith(redirect);
    });
  }

  it('shows the safe API error', () => {
    auth.login.and.returnValue(throwError(() => new AppError({ message: 'Invalid credentials.' })));
    const fixture = TestBed.createComponent(UnifiedLoginComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ username: 'user', password: 'wrong' });
    component.submit();
    expect(component.error()).toBe('Invalid credentials.');
  });
});
