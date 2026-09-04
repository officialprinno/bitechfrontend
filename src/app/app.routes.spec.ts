import { routes } from './app.routes';

describe('authentication routes', () => {
  it('has one primary login and redirects both legacy URLs', () => {
    expect(routes.find((route) => route.path === 'login')?.loadComponent).toBeDefined();
    expect(routes.find((route) => route.path === 'admin/login')?.redirectTo).toBe('login');
    expect(routes.find((route) => route.path === 'agent/login')?.redirectTo).toBe('login');
  });
});
