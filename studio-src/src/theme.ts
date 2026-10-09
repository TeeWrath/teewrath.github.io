import { useEffect, useState } from 'react';

export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'studio-theme';

const read = (): Theme => {
  try { return (localStorage.getItem(KEY) as Theme) || 'auto'; } catch { return 'auto'; }
};
const apply = (t: Theme) => {
  const d = document.documentElement;
  if (t === 'auto') d.removeAttribute('data-theme');
  else d.setAttribute('data-theme', t);
};
apply(read());

export function useTheme() {
  const [theme, set] = useState<Theme>(read);
  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
  }, [theme]);
  const next: Theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  return { theme, cycle: () => set(next), label: { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' }[theme] };
}
