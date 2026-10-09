import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, AUTHOR_EMAIL } from './supabase';
import Login from './Login';
import PostList from './PostList';
import EditorPage from './EditorPage';

const useHash = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const hash = useHash();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="boot">Loading…</div>;
  if (!session) return <Login />;
  if (session.user.email !== AUTHOR_EMAIL)
    return (
      <div className="boot">
        This studio is private. <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );

  const m = hash.match(/^#\/edit\/(.+)$/);
  return m ? <EditorPage id={m[1]} /> : <PostList />;
}
