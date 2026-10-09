import { useEffect, useMemo, useState } from 'react';
import { supabase, type Post } from './supabase';

type Filter = 'all' | 'draft' | 'published';

export default function PostList() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [err, setErr] = useState('');

  const load = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id,slug,title,excerpt,category,status,published_at,updated_at,cover_url,reading_min')
      .order('updated_at', { ascending: false });
    if (error) setErr(error.message);
    else setPosts(data as unknown as Post[]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const { data, error } = await supabase
      .from('posts')
      .insert({ slug: 'untitled-' + Math.random().toString(36).slice(2, 8), title: 'Untitled' })
      .select('id')
      .single();
    if (error) return setErr(error.message);
    location.hash = `#/edit/${data.id}`;
  };

  const remove = async (p: Post) => {
    if (!confirm(`Delete "${p.title}" permanently?`)) return;
    const { error } = await supabase.from('posts').delete().eq('id', p.id);
    if (error) setErr(error.message);
    else load();
  };

  const shown = useMemo(
    () =>
      (posts ?? []).filter(
        (p) =>
          (filter === 'all' || p.status === filter) &&
          (p.title + ' ' + p.category).toLowerCase().includes(q.toLowerCase()),
      ),
    [posts, q, filter],
  );

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Studio</strong>
        <span className="spacer" />
        <a className="btn ghost" href="../blog.html" target="_blank" rel="noopener">View blog ↗</a>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        <button className="btn primary" onClick={create}>+ New post</button>
      </header>

      <main className="list">
        <div className="list-tools">
          <input placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg">
            {(['all', 'draft', 'published'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {err && <p className="err">{err}</p>}
        {posts === null && !err && <p className="muted">Loading…</p>}
        {posts && !shown.length && <p className="muted">No posts yet. Hit “New post”.</p>}
        <ul>
          {shown.map((p) => {
            const scheduled = p.status === 'published' && p.published_at && new Date(p.published_at) > new Date();
            return (
              <li key={p.id}>
                <a href={`#/edit/${p.id}`} className="row">
                  <span className="thumb">{p.cover_url ? <img src={p.cover_url} alt="" /> : null}</span>
                  <span className="main">
                    <span className="title">{p.title || 'Untitled'}</span>
                    <span className="meta">
                      <span className={`chip ${scheduled ? 'sched' : p.status}`}>{scheduled ? 'scheduled' : p.status}</span>
                      {p.category && <span>{p.category}</span>}
                      <span>{p.reading_min} min</span>
                      <span>{p.status === 'published' ? `Published ${fmt(p.published_at)}` : `Edited ${fmt(p.updated_at)}`}</span>
                    </span>
                  </span>
                </a>
                <button className="btn ghost danger" onClick={() => remove(p)}>Delete</button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
