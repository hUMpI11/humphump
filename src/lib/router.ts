import { useSyncExternalStore } from 'react';

export type Tab = 'uebersicht' | 'stunden' | 'material' | 'notizen' | 'fotos' | 'skizzen';
export const TABS: Tab[] = ['uebersicht', 'stunden', 'material', 'notizen', 'fotos', 'skizzen'];

export type Route =
  | { name: 'home' }
  | { name: 'neu' }
  | { name: 'einstellungen' }
  | { name: 'woche' }
  | { name: 'projekt'; id: string; tab: Tab }
  | { name: 'bearbeiten'; id: string }
  | { name: 'bericht'; id: string }
  | { name: 'skizze'; id: string; sketchId: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'neu') return { name: 'neu' };
  if (parts[0] === 'einstellungen') return { name: 'einstellungen' };
  if (parts[0] === 'woche') return { name: 'woche' };
  if (parts[0] === 'p' && parts[1]) {
    const id = parts[1];
    if (parts[2] === 'bearbeiten') return { name: 'bearbeiten', id };
    if (parts[2] === 'bericht') return { name: 'bericht', id };
    if (parts[2] === 'skizze' && parts[3]) return { name: 'skizze', id, sketchId: parts[3] };
    const tab = TABS.includes(parts[2] as Tab) ? (parts[2] as Tab) : 'uebersicht';
    return { name: 'projekt', id, tab };
  }
  return { name: 'home' };
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

// Hash-Routing: funktioniert ohne Server-Konfiguration unter jedem Pfad und offline.
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

export function go(path: string, replace = false) {
  const target = '#' + path;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}
