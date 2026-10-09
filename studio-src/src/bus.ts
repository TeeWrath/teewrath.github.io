import { useEffect, useRef } from 'react';

// Tiny event bus so the command palette, shortcuts and toasts can talk to whichever page is mounted.
export const emit = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent('studio:' + name, { detail }));
export const toast = (msg: string) => emit('toast', msg);

export function useBus<T = unknown>(name: string, fn: (detail: T) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent).detail as T);
    window.addEventListener('studio:' + name, h);
    return () => window.removeEventListener('studio:' + name, h);
  }, [name]);
}

export const ago = (iso: string | null) => {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  const f = s < 0;
  const a = Math.abs(s);
  const t = a < 60 ? 'just now' : a < 3600 ? `${Math.floor(a / 60)}m` : a < 86400 ? `${Math.floor(a / 3600)}h` : a < 86400 * 30 ? `${Math.floor(a / 86400)}d` : a < 86400 * 365 ? `${Math.floor(a / 86400 / 30)}mo` : `${Math.floor(a / 86400 / 365)}y`;
  if (t === 'just now') return t;
  return f ? `in ${t}` : `${t} ago`;
};
