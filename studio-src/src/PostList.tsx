import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase, type Post } from './supabase';
import { useTheme } from './theme';

type Row = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'category' | 'status' | 'published_at' | 'updated_at' | 'cover_url' | 'reading_min'>;
type Filter = 'all' | 'draft' | 'published' | 'scheduled';
type Sort = 'updated' | 'published' | 'title';

interface LegacyPost { id: string; type: string; title: string; category?: string; date: string; cover?: string; excerpt?: string; file?: string }

const isScheduled = (p: Row) => p.status === 'published' && !!p.published_at && new Date(p.published_at) > new Date();
const kindOf = (p: Row): Filter => (isScheduled(p) ? 'scheduled' : p.status);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const siteUrl = (slug: string) => `${location.origin}/post.html?id=${encodeURIComponent(slug)}`;

export default function PostList() {
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [legacy, setLegacy] = useState<LegacyPost[]>([]);
  const [busy, setBusy] = useState(false);
  const { cycle, label } = useTheme();

  const load = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id,slug,title,excerpt,category,status,published_at,updated_at,cover_url,reading_min')
      .order('updated_at', { ascending: false });
    if (error) setErr(error.message);
    else { setPosts(data as Row[]); setErr(''); }
  };
  useEffect(() => { load(); }, []);

  // file-based posts from blog/posts.json that aren't in Supabase yet
  useEffect(() => {
    if (!posts) return;
    fetch('../blog/posts.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((all: LegacyPost[]) => {
        const have = new Set(posts.map((p) => p.slug));
        setLegacy(all.filter((p) => p.type === 'self' && p.file && !have.has(p.id)));
      })
      .catch(() => setLegacy([]));
  }, [posts]);

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 2500); };

  const create = async () => {
    const { data, error } = await supabase
      .from('posts')
      .insert({ slug: 'untitled-' + Math.random().toString(36).slice(2, 8), title: 'Untitled' })
      .select('id')
      .single();
    if (error) return setErr(error.message);
    location.hash = `#/edit/${data.id}`;
  };

  const remove = async (p: Row) => {
    if (!confirm(`Delete "${p.title}" permanently? This can't be undone.`)) return;
    const { error } = await supabase.from('posts').delete().eq('id', p.id);
    if (error) setErr(error.message);
    else { flash('Deleted'); load(); }
  };

  const duplicate = async (p: Row) => {
    const { data, error } = await supabase.from('posts').select('*').eq('id', p.id).single();
    if (error || !data) return setErr(error?.message || 'Could not copy');
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = data as Post;
    const copy = { ...rest, title: `${rest.title} (copy)`, slug: `${rest.slug}-copy-${Math.random().toString(36).slice(2, 5)}`, status: 'draft', published_at: null };
    const ins = await supabase.from('posts').insert(copy).select('id').single();
    if (ins.error) return setErr(ins.error.message);
    location.hash = `#/edit/${ins.data.id}`;
  };

  const setStatus = async (p: Row, status: 'draft' | 'published') => {
    const patch = status === 'published' ? { status, published_at: p.published_at || new Date().toISOString() } : { status };
    const { error } = await supabase.from('posts').update(patch).eq('id', p.id);
    if (error) setErr(error.message);
    else { flash(status === 'published' ? 'Published' : 'Moved to drafts'); load(); }
  };

  const copyLink = async (p: Row) => {
    try { await navigator.clipboard.writeText(siteUrl(p.slug)); flash('Link copied'); } catch { flash(siteUrl(p.slug)); }
  };

  const importLegacy = async () => {
    setBusy(true);
    let done = 0;
    for (const p of legacy) {
      try {
        const md = await fetch('../' + p.file!.replace(/^\.\//, '')).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
        const html = await marked.parse(md);
        const text = md.replace(/[#*_`>\[\]()-]/g, ' ');
        const cover = p.cover ? new URL('../' + encodeURI(p.cover.replace(/^\.\//, '')), location.href).href : null;
        const { error } = await supabase.from('posts').insert({
          slug: p.id, title: p.title, excerpt: p.excerpt || '', category: p.category || '',
          cover_url: cover, content_html: html, status: 'published',
          published_at: new Date(p.date + 'T09:00:00').toISOString(),
          reading_min: Math.max(1, Math.round(text.split(/\s+/).length / 220)),
        });
        if (error) throw error;
        done++;
      } catch (e) {
        setErr(`Import of "${p.title}" failed: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    flash(`Imported ${done} post${done === 1 ? '' : 's'}`);
    load();
  };

  const cats = useMemo(() => Array.from(new Set((posts ?? []).map((p) => p.category).filter(Boolean))).sort(), [posts]);
  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, published: 0, scheduled: 0, minutes: 0 };
    (posts ?? []).forEach((p) => { c.all++; c[kindOf(p) as 'draft' | 'published' | 'scheduled']++; c.minutes += p.reading_min; });
    return c;
  }, [posts]);

  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    const out = (posts ?? []).filter(
      (p) => (filter === 'all' || kindOf(p) === filter) && (!cat || p.category === cat) && (p.title + ' ' + p.category + ' ' + p.slug).toLowerCase().includes(needle),
    );
    out.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'published' ? Date.parse(b.published_at || '0') - Date.parse(a.published_at || '0')
          : Date.parse(b.updated_at) - Date.parse(a.updated_at),
    );
    return out;
  }, [posts, q, filter, cat, sort]);

  const tab = (f: Filter, name: string) => (
    <button className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{name} <span>{counts[f]}</span></button>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Studio</strong>
        <span className="spacer" />
        <a className="btn ghost hide-s" href="../blog.html" target="_blank" rel="noopener">View blog ↗</a>
        <button className="btn ghost hide-s" onClick={cycle}>{label}</button>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        <button className="btn primary" onClick={create}>+ New post</button>
      </header>
      {note && <div className="toast">{note}</div>}

      <main className="list">
        <div className="stats">
          <div><b>{counts.all}</b><span>Posts</span></div>
          <div><b>{counts.published}</b><span>Published</span></div>
          <div><b>{counts.draft}</b><span>Drafts</span></div>
          <div><b>{counts.scheduled}</b><span>Scheduled</span></div>
          <div><b>{counts.minutes}</b><span>Min of reading</span></div>
        </div>

        {legacy.length > 0 && (
          <div className="import">
            <div>
              <b>{legacy.length} existing post{legacy.length === 1 ? '' : 's'} still live in markdown files</b>
              <span>Import {legacy.map((p) => `“${p.title}”`).join(', ')} so you can edit and manage {legacy.length === 1 ? 'it' : 'them'} here.</span>
            </div>
            <button className="btn primary" disabled={busy} onClick={importLegacy}>{busy ? 'Importing…' : 'Import now'}</button>
          </div>
        )}

        <div className="list-tools">
          <input placeholder="Search title, category, slug…" value={q} onChange={(e) => setQ(e.target.value)} />
          {cats.length > 0 && (
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="updated">Recently edited</option>
            <option value="published">Publish date</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
        <div className="seg tabs">
          {tab('all', 'All')}{tab('published', 'Published')}{tab('scheduled', 'Scheduled')}{tab('draft', 'Drafts')}
        </div>

        {err && <p className="err">{err}</p>}
        {posts === null && !err && <p className="muted">Loading…</p>}
        {posts && !posts.length && (
          <div className="empty">
            <h2>Write your first post</h2>
            <p className="muted">Everything autosaves. Type <kbd>/</kbd> inside the editor for blocks, drop images straight in.</p>
            <button className="btn primary" onClick={create}>+ New post</button>
          </div>
        )}
        {posts && posts.length > 0 && !shown.length && <p className="muted">Nothing matches those filters.</p>}

        <ul>
          {shown.map((p) => {
            const kind = kindOf(p);
            return (
              <li key={p.id}>
                <a href={`#/edit/${p.id}`} className="row">
                  <span className="thumb">{p.cover_url ? <img src={p.cover_url} alt="" loading="lazy" /> : null}</span>
                  <span className="main">
                    <span className="title">{p.title || 'Untitled'}</span>
                    {p.excerpt && <span className="excerpt">{p.excerpt}</span>}
                    <span className="meta">
                      <span className={`chip ${kind}`}>{kind}</span>
                      {p.category && <span>{p.category}</span>}
                      <span>{p.reading_min} min</span>
                      <span>{kind === 'draft' ? `Edited ${fmt(p.updated_at)}` : `${kind === 'scheduled' ? 'Goes live' : 'Published'} ${fmt(p.published_at)}`}</span>
                    </span>
                  </span>
                </a>
                <details className="menu">
                  <summary aria-label="Post actions">⋯</summary>
                  <div onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                    <a href={`#/edit/${p.id}`}>Edit</a>
                    {p.status === 'published'
                      ? <button onClick={() => setStatus(p, 'draft')}>Unpublish</button>
                      : <button onClick={() => setStatus(p, 'published')}>Publish now</button>}
                    {p.status === 'published' && !isScheduled(p) && <a href={siteUrl(p.slug)} target="_blank" rel="noopener">View live ↗</a>}
                    <button onClick={() => copyLink(p)}>Copy link</button>
                    <button onClick={() => duplicate(p)}>Duplicate</button>
                    <button className="danger" onClick={() => remove(p)}>Delete</button>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
