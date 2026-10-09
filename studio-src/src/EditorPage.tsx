import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Youtube from '@tiptap/extension-youtube';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import { common, createLowlight } from 'lowlight';
import type { SuggestionProps } from '@tiptap/suggestion';
import { supabase, uploadImage, slugify, type Post } from './supabase';
import { Callout, SizedImage, SlashCommand, buildItems, type SlashItem, type SlashUI } from './extensions';
import { useTheme } from './theme';

const lowlight = createLowlight(common);

type Meta = Pick<Post, 'title' | 'slug' | 'excerpt' | 'category' | 'tags' | 'cover_url' | 'cover_alt' | 'seo_title' | 'seo_desc' | 'status' | 'published_at'>;
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type Backup = { t: number; json: unknown; meta: Meta };
type Heading = { level: number; text: string; pos: number };

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function EditorPage({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<{ meta: Meta; content: unknown; updated: string } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoaded(null);
    supabase.from('posts').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) return setMsg(error?.message || 'Post not found');
      const p = data as Post;
      setLoaded({
        content: p.content_json ?? p.content_html ?? '',
        updated: p.updated_at,
        meta: { title: p.title, slug: p.slug, excerpt: p.excerpt, category: p.category, tags: p.tags, cover_url: p.cover_url, cover_alt: p.cover_alt, seo_title: p.seo_title, seo_desc: p.seo_desc, status: p.status, published_at: p.published_at },
      });
    });
  }, [id]);

  if (!loaded) return <div className="boot">{msg || 'Loading…'}</div>;
  return <Editor key={id} id={id} initialMeta={loaded.meta} initialContent={loaded.content} serverUpdated={loaded.updated} />;
}

function Editor({ id, initialMeta, initialContent, serverUpdated }: { id: string; initialMeta: Meta; initialContent: unknown; serverUpdated: string }) {
  const BK = `studio-backup-${id}`;
  const [meta, setMetaRaw] = useState<Meta>(initialMeta);
  const metaRef = useRef(meta);
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'settings' | 'outline' | null>('settings');
  const [focus, setFocus] = useState(false);
  const [preview, setPreview] = useState<null | 'desktop' | 'mobile'>(null);
  const [linkBar, setLinkBar] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [recover, setRecover] = useState<Backup | null>(null);
  const [slash, setSlash] = useState<{ items: SlashItem[]; rect: DOMRect | null; index: number; run: (i: SlashItem) => void } | null>(null);
  const { cycle, label } = useTheme();

  const timer = useRef<number | undefined>(undefined);
  const saving = useRef(false);
  const again = useRef(false);
  const slugAuto = useRef(initialMeta.slug.startsWith('untitled-') || initialMeta.slug === slugify(initialMeta.title));
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const slashRef = useRef(slash);
  slashRef.current = slash;
  const slashUI = useRef<SlashUI | null>(null);
  const uploadRef = useRef<(f: File, pos?: number) => void>(() => {});
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const items = useMemo(() => buildItems(() => fileInput.current?.click()), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true } }),
      SizedImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Start writing… type '/' for commands" }),
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Youtube.configure({ nocookie: true }),
      CharacterCount, Highlight, Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Callout,
      SlashCommand(slashUI, () => items),
    ],
    content: initialContent as never,
    editorProps: {
      attributes: { class: 'prose', spellcheck: 'true' },
      handleDrop: (view, ev) => {
        const f = ev.dataTransfer?.files?.[0];
        if (!f || !f.type.startsWith('image/')) return false;
        ev.preventDefault();
        uploadRef.current(f, view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos);
        return true;
      },
      handlePaste: (_v, ev) => {
        const f = Array.from(ev.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
        if (!f) return false;
        uploadRef.current(f);
        return true;
      },
    },
    onUpdate: () => schedule(),
  });
  editorRef.current = editor;

  // ── slash menu bridge ──
  useEffect(() => {
    const open = (p: SuggestionProps<SlashItem>, keep = false) =>
      setSlash((s) => ({ items: p.items, rect: p.clientRect?.() ?? null, index: keep ? Math.min(s?.index ?? 0, Math.max(0, p.items.length - 1)) : 0, run: (i) => p.command(i) }));
    slashUI.current = {
      start: (p) => open(p),
      update: (p) => open(p, true),
      exit: () => setSlash(null),
      key: (e) => {
        const s = slashRef.current;
        if (!s || !s.items.length) return false;
        if (e.key === 'ArrowDown') { setSlash({ ...s, index: (s.index + 1) % s.items.length }); return true; }
        if (e.key === 'ArrowUp') { setSlash({ ...s, index: (s.index - 1 + s.items.length) % s.items.length }); return true; }
        if (e.key === 'Enter' || e.key === 'Tab') { s.run(s.items[s.index]); return true; }
        if (e.key === 'Escape') { setSlash(null); return true; }
        return false;
      },
    };
  }, []);

  // ── image upload ──
  uploadRef.current = async (file, pos) => {
    const ed = editorRef.current;
    if (!ed) return;
    setErr('Uploading image…');
    try {
      const src = await uploadImage(file);
      const chain = ed.chain().focus();
      if (pos != null) chain.setTextSelection(pos);
      chain.setImage({ src, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }).run();
      setErr('');
    } catch (e) {
      setErr('Upload failed: ' + (e as Error).message);
    }
  };

  // ── saving (all refs, so timer callbacks never see stale closures) ──
  async function save() {
    const ed = editorRef.current;
    if (!ed) return;
    if (saving.current) { again.current = true; return; }
    saving.current = true;
    setState('saving');
    const m = metaRef.current;
    const words = ed.storage.characterCount.words();
    const payload = {
      ...m,
      slug: m.slug || 'untitled-' + id.slice(0, 6),
      content_json: ed.getJSON(),
      content_html: ed.getHTML(),
      reading_min: Math.max(1, Math.round(words / 220)),
    };
    let { error } = await supabase.from('posts').update(payload).eq('id', id);
    if (error?.code === '23505') {
      payload.slug = `${payload.slug}-${Math.random().toString(36).slice(2, 5)}`;
      ({ error } = await supabase.from('posts').update(payload).eq('id', id));
      if (!error) { metaRef.current = { ...m, slug: payload.slug }; setMetaRaw(metaRef.current); }
    }
    saving.current = false;
    if (error) { setState('error'); setErr(error.message); return; }
    setErr('');
    try { localStorage.removeItem(BK); } catch { /* ignore */ }
    if (again.current) { again.current = false; schedule(); }
    else { setState('saved'); setSavedAt(new Date()); }
  }

  function schedule() {
    setState('dirty');
    const ed = editorRef.current;
    if (ed) {
      try { localStorage.setItem(BK, JSON.stringify({ t: Date.now(), json: ed.getJSON(), meta: metaRef.current })); } catch { /* quota */ }
    }
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(), 1200);
  }

  const setMeta = (patch: Partial<Meta>) => {
    const next = { ...metaRef.current, ...patch };
    if ('title' in patch && slugAuto.current && next.status === 'draft') next.slug = slugify(next.title) || next.slug;
    if ('slug' in patch) slugAuto.current = false;
    metaRef.current = next;
    setMetaRaw(next);
    schedule();
  };

  // crash recovery: a local backup newer than the server copy means a save never landed
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(BK) || 'null') as Backup | null;
      if (b && b.t > Date.parse(serverUpdated) + 2000) setRecover(b);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (stateRef.current === 'dirty' || stateRef.current === 'saving') e.preventDefault(); };
    addEventListener('beforeunload', on);
    return () => { removeEventListener('beforeunload', on); clearTimeout(timer.current); };
  }, []);

  // ── shortcuts ──
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { setFocus(false); setLinkBar(null); setPublishOpen(false); return; }
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); clearTimeout(timer.current); save(); }
      else if (k === 'k') { e.preventDefault(); openLink(); }
      else if (e.shiftKey && k === 'f') { e.preventDefault(); setFocus((f) => !f); }
      else if (e.shiftKey && k === 'p') { e.preventDefault(); setPreview((p) => (p ? null : 'desktop')); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });

  // ── derived ──
  const words = useEditorState({ editor, selector: (s) => s.editor?.storage.characterCount.words() ?? 0 });
  const headings = useEditorState({
    editor,
    selector: (s): Heading[] => {
      const out: Heading[] = [];
      s.editor?.state.doc.descendants((n, pos) => {
        if (n.type.name === 'heading') out.push({ level: n.attrs.level, text: n.textContent, pos });
      });
      return out;
    },
  });
  const inCallout = useEditorState({ editor, selector: (s) => s.editor?.isActive('callout') ?? false });
  const inTable = useEditorState({ editor, selector: (s) => s.editor?.isActive('table') ?? false });
  const imageAttrs = useEditorState({ editor, selector: (s) => (s.editor?.isActive('image') ? (s.editor.getAttributes('image') as Record<string, string | number | null>) : null) });

  const live = meta.status === 'published';
  const scheduled = !!(live && meta.published_at && new Date(meta.published_at) > new Date());

  function openLink() {
    const ed = editorRef.current;
    if (!ed) return;
    setLinkBar((ed.getAttributes('link').href as string) || '');
  }
  const applyLink = (raw: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    let url = raw.trim();
    if (url && !/^([a-z]+:|\/|#)/i.test(url)) url = 'https://' + url;
    const c = ed.chain().focus().extendMarkRange('link');
    if (url) c.setLink({ href: url }).run(); else c.unsetLink().run();
    setLinkBar(null);
  };

  const togglePublish = async () => {
    if (live) {
      if (!confirm('Unpublish this post? It will disappear from your blog.')) return;
      metaRef.current = { ...metaRef.current, status: 'draft' };
      setMetaRaw(metaRef.current);
      clearTimeout(timer.current);
      await save();
    } else setPublishOpen(true);
  };
  const confirmPublish = async (whenIso: string | null) => {
    metaRef.current = { ...metaRef.current, status: 'published', published_at: whenIso || new Date().toISOString() };
    setMetaRaw(metaRef.current);
    setPublishOpen(false);
    clearTimeout(timer.current);
    await save();
  };

  const back = async () => {
    clearTimeout(timer.current);
    if (stateRef.current === 'dirty') await save();
    location.hash = '#/';
  };

  if (!editor) return null;

  const btn = (label: string, active: boolean, run: () => void, title?: string) => (
    <button type="button" className={active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={run} title={title}>{label}</button>
  );
  const c = () => editor.chain().focus();
  const statusText = { saved: savedAt ? `Saved ${hhmm(savedAt)}` : 'Saved', dirty: 'Unsaved…', saving: 'Saving…', error: 'Save failed — kept locally' }[state];

  return (
    <div className={`shell editor ${focus ? 'focus' : ''}`}>
      <header className="topbar">
        <button className="btn ghost" onClick={back}>← Posts</button>
        <span className={`save ${state}`}>{statusText}</span>
        <span className="spacer" />
        <span className="muted hide-s">{words} words · {Math.max(1, Math.round(words / 220))} min</span>
        <button className={`btn ghost ${preview ? 'active' : ''}`} onClick={() => setPreview(preview ? null : 'desktop')} title="Preview (⌘⇧P)">{preview ? 'Edit' : 'Preview'}</button>
        <button className="btn ghost" onClick={() => setFocus(true)} title="Focus mode (⌘⇧F)">Focus</button>
        <button className="btn ghost hide-s" onClick={cycle}>{label}</button>
        <button className={`btn ghost ${panel ? 'active' : ''}`} onClick={() => setPanel(panel ? null : 'settings')}>Settings</button>
        {live && !scheduled && <a className="btn ghost hide-s" href={`../post.html?id=${encodeURIComponent(meta.slug)}`} target="_blank" rel="noopener">View ↗</a>}
        <button className={`btn ${live ? '' : 'primary'}`} onClick={togglePublish}>{live ? (scheduled ? 'Unschedule' : 'Unpublish') : 'Publish'}</button>
      </header>
      {focus && <button className="focus-exit" onClick={() => setFocus(false)}>Exit focus · Esc</button>}

      {err && <div className="banner">{err}</div>}
      {recover && (
        <div className="banner info">
          Found unsaved changes from {new Date(recover.t).toLocaleString()} that never reached the server.
          <button className="btn" onClick={() => { editor.commands.setContent(recover.json as never); metaRef.current = recover.meta; setMetaRaw(recover.meta); setRecover(null); schedule(); }}>Restore them</button>
          <button className="btn ghost" onClick={() => { try { localStorage.removeItem(BK); } catch { /* */ } setRecover(null); }}>Discard</button>
        </div>
      )}

      <div className="split">
        <main className="paper">
          <div className="toolbar" hidden={!!preview}>
            {btn('B', editor.isActive('bold'), () => c().toggleBold().run(), 'Bold ⌘B')}
            {btn('I', editor.isActive('italic'), () => c().toggleItalic().run(), 'Italic ⌘I')}
            {btn('U', editor.isActive('underline'), () => c().toggleUnderline().run(), 'Underline ⌘U')}
            {btn('S', editor.isActive('strike'), () => c().toggleStrike().run(), 'Strikethrough')}
            {btn('Hi', editor.isActive('highlight'), () => c().toggleHighlight().run(), 'Highlight')}
            {btn('</>', editor.isActive('code'), () => c().toggleCode().run(), 'Inline code')}
            <i />
            {btn('H2', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
            {btn('H3', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run())}
            {btn('• List', editor.isActive('bulletList'), () => c().toggleBulletList().run())}
            {btn('1. List', editor.isActive('orderedList'), () => c().toggleOrderedList().run())}
            {btn('☑', editor.isActive('taskList'), () => c().toggleTaskList().run(), 'Checklist')}
            {btn('❝', editor.isActive('blockquote'), () => c().toggleBlockquote().run(), 'Quote')}
            {btn('Code', editor.isActive('codeBlock'), () => c().toggleCodeBlock().run(), 'Code block')}
            <i />
            {btn('Link', editor.isActive('link'), openLink, 'Link ⌘K')}
            {btn('Image', false, () => fileInput.current?.click())}
            {btn('Table', false, () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
            {btn('Callout', inCallout, () => c().insertContent({ type: 'callout', attrs: { kind: 'info' }, content: [{ type: 'paragraph' }] }).run())}
            <i />
            {btn('↶', false, () => c().undo().run(), 'Undo')}
            {btn('↷', false, () => c().redo().run(), 'Redo')}
          </div>

          {preview && (
            <div className="preview-bar">
              <button className={preview === 'desktop' ? 'on' : ''} onClick={() => setPreview('desktop')}>Desktop</button>
              <button className={preview === 'mobile' ? 'on' : ''} onClick={() => setPreview('mobile')}>Mobile</button>
              <span className="muted small">This is how readers will see it.</span>
            </div>
          )}

          <article className={`doc ${preview ? 'is-hidden' : ''}`}>
            <textarea
              className="title-input"
              rows={1}
              placeholder="Post title"
              value={meta.title}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              onChange={(e) => setMeta({ title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } }}
            />
            {meta.cover_url && <img className="cover" src={meta.cover_url} alt={meta.cover_alt} />}
            <EditorContent editor={editor} />
          </article>

          {preview && (
            <div className={`preview ${preview}`}>
              <div className="reader">
                <p className="reader-meta">{meta.category || 'Uncategorised'} · {Math.max(1, Math.round(words / 220))} min read</p>
                <h1>{meta.title || 'Untitled'}</h1>
                {meta.cover_url && <img className="cover" src={meta.cover_url} alt={meta.cover_alt} />}
                <div className="body" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
              </div>
            </div>
          )}

          <BubbleMenu editor={editor} shouldShow={({ editor: e, state: s }) => !s.selection.empty && !e.isActive('image') && !e.isActive('codeBlock')}>
            <div className="bubble">
              {btn('B', editor.isActive('bold'), () => c().toggleBold().run())}
              {btn('I', editor.isActive('italic'), () => c().toggleItalic().run())}
              {btn('U', editor.isActive('underline'), () => c().toggleUnderline().run())}
              {btn('Hi', editor.isActive('highlight'), () => c().toggleHighlight().run())}
              {btn('</>', editor.isActive('code'), () => c().toggleCode().run())}
              {btn('Link', editor.isActive('link'), openLink)}
              {btn('H2', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
              {btn('H3', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run())}
            </div>
          </BubbleMenu>

          {/* contextual bars: only one shows at a time, anchored bottom-centre */}
          {linkBar !== null ? (
            <form className="ctxbar" onSubmit={(e) => { e.preventDefault(); applyLink(linkBar); }}>
              <input autoFocus placeholder="Paste or type a link — empty removes it" value={linkBar} onChange={(e) => setLinkBar(e.target.value)} />
              <button className="btn primary">Apply</button>
              <button type="button" className="btn ghost" onClick={() => setLinkBar(null)}>Cancel</button>
            </form>
          ) : imageAttrs ? (
            <div className="ctxbar">
              <input placeholder="Alt text (accessibility & SEO)" value={(imageAttrs.alt as string) || ''} onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()} />
              <input placeholder="Caption (optional)" value={(imageAttrs.title as string) || ''} onChange={(e) => editor.chain().updateAttributes('image', { title: e.target.value }).run()} />
              <span className="seg sm">
                {[[50, 'S'], [75, 'M'], [null, 'Full']].map(([w, l]) => (
                  <button key={String(l)} className={(imageAttrs.width ?? null) === w ? 'on' : ''} onClick={() => editor.chain().updateAttributes('image', { width: w }).run()}>{l}</button>
                ))}
              </span>
            </div>
          ) : inTable ? (
            <div className="ctxbar tools">
              <button onClick={() => c().addRowAfter().run()}>+ Row</button>
              <button onClick={() => c().addColumnAfter().run()}>+ Column</button>
              <button onClick={() => c().deleteRow().run()}>− Row</button>
              <button onClick={() => c().deleteColumn().run()}>− Column</button>
              <button onClick={() => c().toggleHeaderRow().run()}>Header row</button>
              <button className="danger" onClick={() => c().deleteTable().run()}>Delete table</button>
            </div>
          ) : inCallout ? (
            <div className="ctxbar tools">
              {['info', 'tip', 'warning'].map((k) => (
                <button key={k} className={editor.getAttributes('callout').kind === k ? 'on' : ''} onClick={() => c().updateAttributes('callout', { kind: k }).run()}>{k}</button>
              ))}
              <button className="danger" onClick={() => c().lift('callout').run()}>Unwrap</button>
            </div>
          ) : null}
        </main>

        {panel && (
          <aside className="side">
            <div className="seg">
              <button className={panel === 'settings' ? 'on' : ''} onClick={() => setPanel('settings')}>Settings</button>
              <button className={panel === 'outline' ? 'on' : ''} onClick={() => setPanel('outline')}>Outline</button>
            </div>

            {panel === 'outline' ? (
              <div className="outline">
                {!headings.length && <p className="muted small">Add H2/H3 headings and they show up here for quick navigation.</p>}
                {headings.map((h) => (
                  <button key={h.pos} style={{ paddingLeft: (h.level - 1) * 12 }} onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}>
                    {h.text || '(empty heading)'}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label>URL slug
                  <input value={meta.slug} onChange={(e) => setMeta({ slug: slugify(e.target.value) })} />
                  <small>/post.html?id={meta.slug}</small>
                </label>
                <label>Category
                  <input value={meta.category} placeholder="Flutter, Programming…" onChange={(e) => setMeta({ category: e.target.value })} />
                </label>
                <label>Tags <small>comma separated</small>
                  <input defaultValue={meta.tags.join(', ')} onBlur={(e) => setMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
                </label>
                <label>Excerpt <small className={meta.excerpt.length > 160 ? 'over' : ''}>{meta.excerpt.length}/160</small>
                  <textarea rows={3} value={meta.excerpt} placeholder="Shown on the blog list and in link previews" onChange={(e) => setMeta({ excerpt: e.target.value })} />
                </label>
                <label>Cover image
                  {meta.cover_url ? (
                    <span className="cover-row">
                      <img src={meta.cover_url} alt="" />
                      <button className="btn ghost" onClick={() => setMeta({ cover_url: null })}>Remove</button>
                    </span>
                  ) : (
                    <button className="btn" onClick={() => coverInput.current?.click()}>Upload cover…</button>
                  )}
                  <input value={meta.cover_alt} placeholder="Cover alt text" onChange={(e) => setMeta({ cover_alt: e.target.value })} />
                </label>
                <label>Publish date <small>future = scheduled</small>
                  <input type="datetime-local" value={toLocalInput(meta.published_at)} onChange={(e) => setMeta({ published_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </label>
                <h3>SEO</h3>
                <label>SEO title <small>{(meta.seo_title || meta.title).length}/60</small>
                  <input value={meta.seo_title} placeholder={meta.title} onChange={(e) => setMeta({ seo_title: e.target.value })} />
                </label>
                <label>SEO description <small>{(meta.seo_desc || meta.excerpt).length}/160</small>
                  <textarea rows={3} value={meta.seo_desc} placeholder={meta.excerpt} onChange={(e) => setMeta({ seo_desc: e.target.value })} />
                </label>
                <div className="serp">
                  <b>{meta.seo_title || meta.title || 'Untitled'}</b>
                  <span>teewrath.github.io › post › {meta.slug}</span>
                  <p>{meta.seo_desc || meta.excerpt || 'Add an excerpt or SEO description.'}</p>
                </div>
                <p className="muted small">Status: <b>{scheduled ? 'scheduled' : meta.status}</b></p>
              </>
            )}
          </aside>
        )}
      </div>

      {slash && slash.rect && slash.items.length > 0 && (
        <ul className="slash" style={{ top: Math.min(slash.rect.bottom + 6, innerHeight - 340), left: Math.min(slash.rect.left, innerWidth - 270) }}>
          {slash.items.map((it, i) => (
            <li key={it.title} className={i === slash.index ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); slash.run(it); }}>
              <b>{it.title}</b><span>{it.hint}</span>
            </li>
          ))}
        </ul>
      )}

      {publishOpen && <PublishDialog editor={editor} meta={meta} onClose={() => setPublishOpen(false)} onConfirm={confirmPublish} />}

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRef.current(f); e.target.value = ''; }} />
      <input ref={coverInput} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { setMeta({ cover_url: await uploadImage(f) }); } catch (x) { setErr('Upload failed: ' + (x as Error).message); }
      }} />
    </div>
  );
}

function PublishDialog({ editor, meta, onClose, onConfirm }: { editor: NonNullable<ReturnType<typeof useEditor>>; meta: Meta; onClose: () => void; onConfirm: (iso: string | null) => void }) {
  const [when, setWhen] = useState<'now' | 'later'>(meta.published_at && new Date(meta.published_at) > new Date() ? 'later' : 'now');
  const [at, setAt] = useState(toLocalInput(meta.published_at && new Date(meta.published_at) > new Date() ? meta.published_at : new Date(Date.now() + 3600e3).toISOString()));

  const words = editor.storage.characterCount.words() as number;
  let imgs = 0, noAlt = 0;
  editor.state.doc.descendants((n) => { if (n.type.name === 'image') { imgs++; if (!n.attrs.alt) noAlt++; } });
  const checks: [boolean, string][] = [
    [!!meta.title.trim() && meta.title !== 'Untitled', 'Has a real title'],
    [words >= 150, `Has substance (${words} words)`],
    [meta.excerpt.trim().length >= 40, 'Excerpt written'],
    [!!meta.cover_url, 'Cover image set'],
    [!!meta.category, 'Category chosen'],
    [noAlt === 0, imgs ? `All ${imgs} image(s) have alt text` : 'Images have alt text'],
  ];
  const todo = checks.filter(([ok]) => !ok).length;

  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Ready to publish?</h2>
        <ul className="checks">
          {checks.map(([ok, t]) => <li key={t} className={ok ? 'ok' : 'no'}>{ok ? '✓' : '○'} {t}</li>)}
        </ul>
        {todo > 0 && <p className="muted small">{todo} thing(s) could be better — you can still publish.</p>}
        <div className="seg">
          <button className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>Publish now</button>
          <button className={when === 'later' ? 'on' : ''} onClick={() => setWhen('later')}>Schedule</button>
        </div>
        {when === 'later' && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onConfirm(when === 'later' && at ? new Date(at).toISOString() : null)}>
            {when === 'later' ? 'Schedule post' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
