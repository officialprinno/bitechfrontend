import { captureHotspotContext, HotspotContextService } from './hotspot-context';

describe('early hotspot capture', () => {
  afterEach(() => sessionStorage.removeItem('bitech.hotspot.context'));

  function browser(search: string) {
    return {
      location: { href: 'https://bitech.rocksolutions.co.tz/' + search } as Location,
      sessionStorage,
      history: { state: { existing: true }, replaceState: jasmine.createSpy('replaceState') } as unknown as History,
    };
  }

  it('stores normalized context before cleaning the URL and survives a clean reload', () => {
    const target = browser('?node_id=buhongwa-01&mac=CE%3A0B%3A2D%3A3E%3A41%3A45&ip=192.168.88.70&link-login=http%3A%2F%2Fhotspot.local%2Flogin&link-orig=http%3A%2F%2Fexample.com%2F&keep=yes#section');
    (target.history.replaceState as jasmine.Spy).and.callFake(() => {
      expect(new HotspotContextService().read()?.link_login).toBe('http://hotspot.local/login');
    });
    captureHotspotContext(target);
    expect(target.history.replaceState).toHaveBeenCalledWith({ existing: true }, '', '/?keep=yes#section');
    captureHotspotContext(browser(''));
    expect(new HotspotContextService().read()).toEqual({
      node_id: 'buhongwa-01', mac: 'CE:0B:2D:3E:41:45', ip: '192.168.88.70',
      link_login: 'http://hotspot.local/login', link_orig: 'http://example.com/',
    });
  });

  it('replaces old device context instead of mixing different arrivals', () => {
    captureHotspotContext(browser('?node_id=old&mac=old&link-login=http://old/login'));
    captureHotspotContext(browser('?node_id=new&mac=new&link_login=http://new/login&link_orig=http://example.com'));
    expect(new HotspotContextService().read()?.node_id).toBe('new');
    expect(new HotspotContextService().read()?.link_login).toBe('http://new/login');
  });

  it('leaves the original URL intact when storage fails', () => {
    const target = browser('?node_id=test&link-login=http://hotspot.local/login');
    target.sessionStorage = { setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    expect(captureHotspotContext(target)?.node_id).toBe('test');
    expect(target.history.replaceState).not.toHaveBeenCalled();
  });
});
