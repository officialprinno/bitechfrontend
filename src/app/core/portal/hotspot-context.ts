import { Injectable } from '@angular/core';

export interface HotspotContext {
  node_id: string;
  site_id?: string;
  mac: string;
  ip: string;
  link_login: string;
  link_orig: string;
}

const KEY = 'bitech.hotspot.context';
const PARAMS = ['node_id', 'site_id', 'mac', 'ip', 'link-login', 'link_login', 'link-orig', 'link_orig'];

/** Runs synchronously before Angular can perform initial navigation. */
export function captureHotspotContext(
  browser: Pick<Window, 'location' | 'sessionStorage' | 'history'> = window,
): HotspotContext | null {
  const url = new URL(browser.location.href);
  const qp = url.searchParams;
  const node = qp.get('node_id');
  if (!node) return null;
  const context: HotspotContext = {
    node_id: node,
    site_id: qp.get('site_id') || undefined,
    mac: qp.get('mac') || '',
    ip: qp.get('ip') || '',
    link_login: qp.get('link-login') || qp.get('link_login') || '',
    link_orig: qp.get('link-orig') || qp.get('link_orig') || '',
  };
  // Never discard the URL when persistence is unavailable.
  try {
    browser.sessionStorage.setItem(KEY, JSON.stringify(context));
  } catch {
    return context;
  }
  for (const param of PARAMS) url.searchParams.delete(param);
  browser.history.replaceState(browser.history.state, '', url.pathname + url.search + url.hash);
  return context;
}

@Injectable({ providedIn: 'root' })
export class HotspotContextService {
  read(): HotspotContext | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return value && typeof value.node_id === 'string' ? value : null;
    } catch {
      return null;
    }
  }
}
