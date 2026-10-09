import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, AUTHOR_EMAIL } from './supabase';
import Login from './Login';
import PostList from './PostList';
import EditorPage from './EditorPage';
import CommandPalette from './CommandPalette';
import Shortcuts from './Shortcuts';
import { useBus } from './bus';
import { useTheme } from './theme';

const useHash = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [palette, setPalette] = useState(false);
  const [keys, setKeys] = useState(false);
  const [toast, setToast] = useState('');
  const hash = useHash();
  const { cycle } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useBus<string>('toast', (m) => { setToast(m); setTimeout(() => setToast(''), 2400); });
  useBus('shortcuts', () => setKeys(true));
  useBus('cycle-theme', cycle);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === '?' && !typing(e.target) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setKeys(true); }
      else if (e.key === 'Escape') { setPalette(false); setKeys(false); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  if (session === undefined) return <div className="boot"><div className="spinner" /></div>;
  if (!session) return <Login />;
  if (session.user.email !== AUTHOR_EMAIL)
    return (
      <div className="boot">
        This studio is private. <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );

  const m = hash.match(/^#\/edit\/(.+)$/);
  return (
    <>
      {m ? <EditorPage id={m[1]} /> : <PostList />}
      {palette && <CommandPalette inEditor={!!m} onClose={() => setPalette(false)} />}
      {keys && <Shortcuts onClose={() => setKeys(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
