import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase, type Post } from './supabase';
import { useTheme } from './theme';
import { Icon } from './icons';
import { ago, toast, useBus } from './bus';

type Row = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'category' | 'status' | 'published_at' | 'updated_at' | 'cover_url' | 'reading_min' | 'tags'>;
type Filter = 'all' | 'draft' | 'published' | 'scheduled';
type Sort = 'updated' | 'published' | 'title';
type View = 'cards' | 'rows';

interface LegacyPost { id: string; type: string; title: string; category?: string; date: string; cover?: string; excerpt?: string; file?: string }

const isScheduled = (p: Row) => p.status === 'published' && !!p.published_at && new Date(p.published_at) > new Date();
const kindOf = (p: Row): Filter => (isScheduled(p) ? 'scheduled' : p.status);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const siteUrl = (slug: string) => `${location.origin}/post.html?id=${encodeURIComponent(slug)}`;
const VIEW_KEY = 'studio-view';

export default function PostList() {
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem(VIEW_KEY) as View) || 'cards'; } catch { return 'cards'; } });
  const [err, setErr] = useState('');
  const [legacy, setLegacy] = useState<LegacyPost[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { cycle, theme } = useTheme();

  const load = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id,slug,title,excerpt,category,tags,status,published_at,updated_at,cover_url,reading_min')
      .order('updated_at', { ascending: false });
    if (error) setErr(error.message);
    else { setPosts(data as Row[]); setErr(''); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ } }, [view]);

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

  const create = async () => {
    const { data, error } = await supabase
      .from('posts')
      .insert({ slug: 'untitled-' + Math.random().toString(36).slice(2, 8), title: 'Untitled' })
      .select('id')
      .single();
    if (error) return setErr(error.message);
    location.hash = `#/edit/${data.id}`;
  };
  useBus('new-post', create);

  // dashboard hotkeys: "/" search, "n" new post
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('search')?.focus(); }
      else if (e.key.toLowerCase() === 'n') { e.preventDefault(); create(); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  const remove = async (p: Row) => {
    if (!confirm(`Delete "${p.title}" permanently? This can't be undone.`)) return;
    const { error } = await supabase.from('posts').delete().eq('id', p.id);
    if (error) setErr(error.message);
    else { toast('Deleted'); load(); }
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
    else { toast(status === 'published' ? 'Published' : 'Moved to drafts'); load(); }
  };

  const copyLink = async (p: Row) => {
    try { await navigator.clipboard.writeText(siteUrl(p.slug)); toast('Link copied'); } catch { toast(siteUrl(p.slug)); }
  };

  const bulk = async (what: 'publish' | 'draft' | 'delete') => {
    const ids = Array.from(sel);
    if (!ids.length) return;
    if (what === 'delete' && !confirm(`Delete ${ids.length} post${ids.length === 1 ? '' : 's'} permanently?`)) return;
    const q = supabase.from('posts');
    const { error } =
      what === 'delete' ? await q.delete().in('id', ids)
        : what === 'publish' ? await q.update({ status: 'published', published_at: new Date().toISOString() }).in('id', ids).is('published_at', null)
          : await q.update({ status: 'draft' }).in('id', ids);
    if (error) return setErr(error.message);
    if (what === 'publish') await supabase.from('posts').update({ status: 'published' }).in('id', ids);
    toast(`${ids.length} updated`);
    setSel(new Set());
    load();
  };

  const renameCat = async (from: string) => {
    const to = prompt(`Rename category "${from}" to:`, from)?.trim();
    if (!to || to === from) return;
    const { error } = await supabase.from('posts').update({ category: to }).eq('category', from);
    if (error) setErr(error.message);
    else { toast('Category renamed'); if (cat === from) setCat(to); load(); }
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
    toast(`Imported ${done} post${done === 1 ? '' : 's'}`);
    load();
  };

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    (posts ?? []).forEach((p) => p.category && m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, published: 0, scheduled: 0, minutes: 0 };
    (posts ?? []).forEach((p) => { c.all++; c[kindOf(p) as 'draft' | 'published' | 'scheduled']++; c.minutes += p.reading_min; });
    return c;
  }, [posts]);

  // published posts per month, last 12 months
  const activity = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), full: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), n: 0 };
    });
    (posts ?? []).forEach((p) => {
      if (p.status !== 'published' || !p.published_at) return;
      const d = new Date(p.published_at);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.n++;
    });
    return months;
  }, [posts]);
  const maxN = Math.max(1, ...activity.map((m) => m.n));

  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    const out = (posts ?? []).filter(
      (p) => (filter === 'all' || kindOf(p) === filter) && (!cat || p.category === cat) && (p.title + ' ' + p.category + ' ' + p.slug + ' ' + p.tags.join(' ')).toLowerCase().includes(needle),
    );
    out.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'published' ? Date.parse(b.published_at || '0') - Date.parse(a.published_at || '0')
          : Date.parse(b.updated_at) - Date.parse(a.updated_at),
    );
    return out;
  }, [posts, q, filter, cat, sort]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = shown.length > 0 && shown.every((p) => sel.has(p.id));
  const themeIcon = theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon';

  const tab = (f: Filter, name: string) => (
    <button className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{name}<span>{counts[f]}</span></button>
  );

  const menu = (p: Row) => (
    <details className="menu">
      <summary className="icon-btn" aria-label="Post actions"><Icon name="more" size={18} /></summary>
      <div className="menu-pop" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
        <a href={`#/edit/${p.id}`}><Icon name="pen" />Edit</a>
        {p.status === 'published'
          ? <button onClick={() => setStatus(p, 'draft')}><Icon name="x" />Unpublish</button>
          : <button onClick={() => setStatus(p, 'published')}><Icon name="send" />Publish now</button>}
        {p.status === 'published' && !isScheduled(p) && <a href={siteUrl(p.slug)} target="_blank" rel="noopener"><Icon name="external" />View live</a>}
        <button onClick={() => copyLink(p)}><Icon name="link" />Copy link</button>
        <button onClick={() => duplicate(p)}><Icon name="copy" />Duplicate</button>
        <button className="danger" onClick={() => remove(p)}><Icon name="trash" />Delete</button>
      </div>
    </details>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <span className="logo"><Icon name="pen" size={15} /></span>
        <strong>Studio</strong>
        <span className="spacer" />
        <button className="btn ghost cmdk hide-s" onClick={() => dispatchEvent(new KeyboardEvent('keydown', { key: 'p', metaKey: true }))}><Icon name="search" />Search<kbd>⌘P</kbd></button>
        <a className="icon-btn" href="../blog.html" target="_blank" rel="noopener" title="View blog"><Icon name="external" /></a>
        <button className="icon-btn" onClick={cycle} title={`Theme: ${theme}`}><Icon name={themeIcon} /></button>
        <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Sign out"><Icon name="logout" /></button>
        <button className="btn primary" onClick={create}><Icon name="plus" />New post</button>
      </header>

      <main className="list">
        <section className="hero">
          <div>
            <h1>Your writing</h1>
            <p className="muted">{counts.all ? `${counts.published} published · ${counts.draft} draft${counts.draft === 1 ? '' : 's'}${counts.scheduled ? ` · ${counts.scheduled} scheduled` : ''} · ${counts.minutes} minutes of reading` : 'Nothing here yet — your first post is one click away.'}</p>
          </div>
          <div className="activity" aria-label="Posts published per month">
            {activity.map((m) => (
              <div key={m.key} title={`${m.full}: ${m.n} post${m.n === 1 ? '' : 's'}`}>
                <i style={{ height: `${8 + (m.n / maxN) * 40}px` }} className={m.n ? 'has' : ''} />
                <span>{m.label[0]}</span>
              </div>
            ))}
          </div>
        </section>

        {legacy.length > 0 && (
          <div className="import">
            <Icon name="download" size={20} />
            <div>
              <b>{legacy.length} existing post{legacy.length === 1 ? '' : 's'} still live as markdown files</b>
              <span>Import {legacy.map((p) => `“${p.title}”`).join(', ')} to edit and manage {legacy.length === 1 ? 'it' : 'them'} here.</span>
            </div>
            <button className="btn primary" disabled={busy} onClick={importLegacy}>{busy ? 'Importing…' : 'Import now'}</button>
          </div>
        )}

        {catCounts.length > 0 && (
          <div className="cats">
            <button className={!cat ? 'on' : ''} onClick={() => setCat('')}>All topics</button>
            {catCounts.map(([c, n]) => (
              <span key={c} className={`catchip ${cat === c ? 'on' : ''}`}>
                <button onClick={() => setCat(cat === c ? '' : c)}>{c}<em>{n}</em></button>
                <button className="ren" onClick={() => renameCat(c)} title="Rename category" aria-label={`Rename ${c}`}><Icon name="pen" size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="list-tools">
          <label className="search"><Icon name="search" /><input id="search" placeholder="Search posts…  ( / )" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}><Icon name="x" size={14} /></button>}</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="updated">Recently edited</option>
            <option value="published">Publish date</option>
            <option value="title">Title A–Z</option>
          </select>
          <div className="seg sm">
            <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')} title="Cards"><Icon name="grid" /></button>
            <button className={view === 'rows' ? 'on' : ''} onClick={() => setView('rows')} title="List"><Icon name="list" /></button>
          </div>
        </div>
        <div className="seg tabs">{tab('all', 'All')}{tab('published', 'Published')}{tab('scheduled', 'Scheduled')}{tab('draft', 'Drafts')}</div>

        {err && <p className="err">{err}</p>}
        {posts === null && !err && (
          <div className={`items ${view}`}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>
        )}
        {posts && !posts.length && (
          <div className="empty">
            <div className="empty-art"><Icon name="pen" size={28} /></div>
            <h2>Write your first post</h2>
            <p className="muted">Everything autosaves. Type <kbd>/</kbd> in the editor for blocks, and drop images straight in.</p>
            <button className="btn primary" onClick={create}><Icon name="plus" />New post</button>
          </div>
        )}
        {posts && posts.length > 0 && !shown.length && <p className="muted center">Nothing matches those filters.</p>}

        {shown.length > 0 && (
          <label className="selectall"><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(shown.map((p) => p.id)))} />Select all</label>
        )}

        <div className={`items ${view}`}>
          {shown.map((p) => {
            const kind = kindOf(p);
            const when = kind === 'draft' ? `Edited ${ago(p.updated_at)}` : `${kind === 'scheduled' ? 'Goes live' : 'Published'} ${fmt(p.published_at)}`;
            return (
              <article key={p.id} className={`item ${sel.has(p.id) ? 'selected' : ''}`}>
                <input className="check" type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.title}`} />
                <a href={`#/edit/${p.id}`} className="thumb" style={p.cover_url ? { backgroundImage: `url("${p.cover_url}")` } : undefined}>
                  {!p.cover_url && <Icon name="image" size={22} />}
                  <span className={`chip ${kind}`}>{kind}</span>
                </a>
                <a href={`#/edit/${p.id}`} className="info">
                  <span className="title">{p.title || 'Untitled'}</span>
                  {p.excerpt && <span className="excerpt">{p.excerpt}</span>}
                  <span className="meta">
                    {p.category && <span className="cat">{p.category}</span>}
                    <span>{p.reading_min} min</span>
                    <span>{when}</span>
                  </span>
                </a>
                {menu(p)}
              </article>
            );
          })}
        </div>
      </main>

      {sel.size > 0 && (
        <div className="bulkbar">
          <b>{sel.size} selected</b>
          <button onClick={() => bulk('publish')}><Icon name="send" />Publish</button>
          <button onClick={() => bulk('draft')}><Icon name="x" />Unpublish</button>
          <button className="danger" onClick={() => bulk('delete')}><Icon name="trash" />Delete</button>
          <button className="icon-btn" onClick={() => setSel(new Set())} aria-label="Clear selection"><Icon name="x" /></button>
        </div>
      )}
    </div>
  );
}
