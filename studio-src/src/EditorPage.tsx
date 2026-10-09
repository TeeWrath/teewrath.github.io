import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
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
import { marked } from 'marked';
import TurndownService from 'turndown';
import type { SuggestionProps } from '@tiptap/suggestion';
import { supabase, uploadImage, slugify, type Post } from './supabase';
import { Callout, SizedImage, SlashCommand, buildItems, type SlashItem, type SlashUI } from './extensions';
import { useTheme } from './theme';
import { Icon } from './icons';
import { emit, toast, useBus } from './bus';

const lowlight = createLowlight(common);

type Meta = Pick<Post, 'title' | 'slug' | 'excerpt' | 'category' | 'tags' | 'cover_url' | 'cover_alt' | 'seo_title' | 'seo_desc' | 'status' | 'published_at'>;
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type Backup = { t: number; json: unknown; meta: Meta };
type Heading = { level: number; text: string; pos: number };
type Panel = 'settings' | 'outline' | null;
type Look = { font: 'serif' | 'sans' | 'mono'; size: number; width: number };

const FONTS = { serif: "'Source Serif 4', Georgia, serif", sans: "Inter, system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace" };
const LOOK_KEY = 'studio-look';
const readLook = (): Look => {
  try { return { font: 'serif', size: 20, width: 720, ...JSON.parse(localStorage.getItem(LOOK_KEY) || '{}') }; } catch { return { font: 'serif', size: 20, width: 720 }; }
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const looksMarkdown = (t: string) => /^(#{1,6} |[-*] |\d+\. |> |```)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/m.test(t) && t.includes('\n');

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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

  if (!loaded)
    return (
      <div className="boot">
        {msg ? <><p>{msg}</p><a className="btn" href="#/">← Back to posts</a></> : <div className="spinner" />}
      </div>
    );
  return <Editor key={id} id={id} initialMeta={loaded.meta} initialContent={loaded.content} serverUpdated={loaded.updated} />;
}

function Editor({ id, initialMeta, initialContent, serverUpdated }: { id: string; initialMeta: Meta; initialContent: unknown; serverUpdated: string }) {
  const BK = `studio-backup-${id}`;
  const [meta, setMetaRaw] = useState<Meta>(initialMeta);
  const metaRef = useRef(meta);
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<Panel>(() => (innerWidth > 1100 ? 'settings' : null));
  const [focus, setFocus] = useState(false);
  const [preview, setPreview] = useState<null | 'desktop' | 'mobile'>(null);
  const [linkBar, setLinkBar] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [recover, setRecover] = useState<Backup | null>(null);
  const [look, setLook] = useState<Look>(readLook);
  const [cats, setCats] = useState<string[]>([]);
  const [slash, setSlash] = useState<{ items: SlashItem[]; rect: DOMRect | null; index: number; run: (i: SlashItem) => void } | null>(null);
  const { cycle, theme } = useTheme();

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
  const hasSelection = useRef(false);

  const items = useMemo(() => buildItems(() => fileInput.current?.click()), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true } }),
      SizedImage.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : "Tell your story… press '/' for blocks") }),
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
        if (f) { uploadRef.current(f); return true; }
        // pasted raw markdown (no rich HTML on the clipboard) → convert it
        const text = ev.clipboardData?.getData('text/plain') ?? '';
        const html = ev.clipboardData?.getData('text/html') ?? '';
        if (!html && looksMarkdown(text)) {
          editorRef.current?.commands.insertContent(marked.parse(text, { async: false }) as string);
          toast('Converted pasted Markdown');
          return true;
        }
        return false;
      },
    },
    onUpdate: () => schedule(),
    onSelectionUpdate: ({ editor: e }) => { hasSelection.current = !e.state.selection.empty; },
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

  // existing categories, for autocomplete
  useEffect(() => {
    supabase.from('posts').select('category').then(({ data }) => {
      const set = new Set(((data as { category: string }[]) ?? []).map((r) => r.category).filter(Boolean));
      setCats(Array.from(set).sort());
    });
  }, []);

  useEffect(() => { try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* private mode */ } }, [look]);

  // ── image upload ──
  uploadRef.current = async (file, pos) => {
    const ed = editorRef.current;
    if (!ed) return;
    toast('Uploading image…');
    try {
      const src = await uploadImage(file);
      const chain = ed.chain().focus();
      if (pos != null) chain.setTextSelection(pos);
      chain.setImage({ src, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }).run();
      toast('Image added — click it to set alt text');
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

  // ── commands coming from the palette ──
  useBus('focus', () => setFocus((f) => !f));
  useBus('preview', () => setPreview((p) => (p ? null : 'desktop')));
  useBus<Panel>('panel', (p) => setPanel(p));
  useBus('publish', () => togglePublish());
  useBus<'md' | 'html' | 'copy'>('export', (kind) => exportAs(kind));

  // ── derived ──
  const words = useEditorState({ editor, selector: (s) => s.editor?.storage.characterCount.words() ?? 0 });
  const chars = useEditorState({ editor, selector: (s) => s.editor?.storage.characterCount.characters() ?? 0 });
  const selWords = useEditorState({
    editor,
    selector: (s) => {
      const e = s.editor;
      if (!e || e.state.selection.empty) return 0;
      const t = e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, ' ');
      return t.trim() ? t.trim().split(/\s+/).length : 0;
    },
  });
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
  const mins = Math.max(1, Math.round(words / 220));

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

  async function togglePublish() {
    if (metaRef.current.status === 'published') {
      if (!confirm('Unpublish this post? It will disappear from your blog.')) return;
      metaRef.current = { ...metaRef.current, status: 'draft' };
      setMetaRaw(metaRef.current);
      clearTimeout(timer.current);
      await save();
      toast('Moved back to drafts');
    } else setPublishOpen(true);
  }
  const confirmPublish = async (whenIso: string | null) => {
    metaRef.current = { ...metaRef.current, status: 'published', published_at: whenIso || new Date().toISOString() };
    setMetaRaw(metaRef.current);
    setPublishOpen(false);
    clearTimeout(timer.current);
    await save();
    toast(whenIso && new Date(whenIso) > new Date() ? 'Scheduled' : 'Published 🎉');
  };

  function exportAs(kind: 'md' | 'html' | 'copy') {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.getHTML();
    const m = metaRef.current;
    if (kind === 'copy') { navigator.clipboard.writeText(html).then(() => toast('HTML copied')); return; }
    if (kind === 'html') return download(`${m.slug || 'post'}.html`, `<h1>${m.title}</h1>\n${html}`, 'text/html');
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
    td.addRule('callout', { filter: (n) => n.nodeName === 'DIV' && (n as HTMLElement).hasAttribute('data-callout'), replacement: (c) => '\n> ' + c.trim().replace(/\n/g, '\n> ') + '\n' });
    download(`${m.slug || 'post'}.md`, `# ${m.title}\n\n${td.turndown(html)}\n`, 'text/markdown');
  }

  const back = async () => {
    clearTimeout(timer.current);
    if (stateRef.current === 'dirty') await save();
    location.hash = '#/';
  };

  if (!editor) return null;

  const tb = (icon: string, active: boolean, run: () => void, title: string, text?: string) => (
    <button type="button" className={active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={run} title={title} aria-label={title}>
      {text ?? <Icon name={icon} />}
    </button>
  );
  const c = () => editor.chain().focus();
  const statusText = { saved: savedAt ? `Saved ${hhmm(savedAt)}` : 'All changes saved', dirty: 'Editing…', saving: 'Saving…', error: 'Not saved — kept locally' }[state];
  const themeIcon = theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon';
  const style = { '--prose-font': FONTS[look.font], '--prose-size': `${look.size}px`, '--doc-width': `${look.width}px` } as React.CSSProperties;

  return (
    <div className={`shell editor ${focus ? 'focus' : ''}`} style={style}>
      <header className="topbar">
        <button className="icon-btn" onClick={back} title="Back to posts" aria-label="Back to posts"><Icon name="back" size={18} /></button>
        <span className={`save ${state}`}><i />{statusText}</span>
        <span className="spacer" />
        <span className={`pill ${scheduled ? 'sched' : meta.status}`}>{scheduled ? 'Scheduled' : live ? 'Live' : 'Draft'}</span>
        <button className={`icon-btn ${preview ? 'active' : ''}`} onClick={() => setPreview(preview ? null : 'desktop')} title="Preview (⌘⇧P)"><Icon name={preview ? 'pen' : 'eye'} /></button>
        <button className="icon-btn" onClick={() => setFocus(true)} title="Focus mode (⌘⇧F)"><Icon name="focus" /></button>
        <details className="menu">
          <summary className="icon-btn" title="Appearance"><Icon name="type" /></summary>
          <div className="menu-pop look">
            <h4>Writing surface</h4>
            <div className="seg sm">
              {(['serif', 'sans', 'mono'] as const).map((f) => <button key={f} className={look.font === f ? 'on' : ''} onClick={() => setLook({ ...look, font: f })}>{f}</button>)}
            </div>
            <label>Text size
              <input type="range" min={16} max={24} value={look.size} onChange={(e) => setLook({ ...look, size: +e.target.value })} />
            </label>
            <label>Column width
              <input type="range" min={560} max={960} step={20} value={look.width} onChange={(e) => setLook({ ...look, width: +e.target.value })} />
            </label>
            <button className="btn ghost" onClick={cycle}><Icon name={themeIcon} />Theme: {theme}</button>
          </div>
        </details>
        <button className={`icon-btn ${panel ? 'active' : ''}`} onClick={() => setPanel(panel ? null : 'settings')} title="Post settings"><Icon name="sliders" /></button>
        <details className="menu">
          <summary className="icon-btn" title="More"><Icon name="more" size={18} /></summary>
          <div className="menu-pop" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
            {live && !scheduled && <a href={`../post.html?id=${encodeURIComponent(meta.slug)}`} target="_blank" rel="noopener"><Icon name="external" />View live</a>}
            <button onClick={() => { navigator.clipboard.writeText(`${location.origin}/post.html?id=${meta.slug}`); toast('Link copied'); }}><Icon name="link" />Copy link</button>
            <button onClick={() => exportAs('md')}><Icon name="download" />Download Markdown</button>
            <button onClick={() => exportAs('html')}><Icon name="download" />Download HTML</button>
            <button onClick={() => exportAs('copy')}><Icon name="copy" />Copy HTML</button>
            <button onClick={() => emit('shortcuts')}><Icon name="keyboard" />Keyboard shortcuts</button>
          </div>
        </details>
        <button className={`btn ${live ? '' : 'primary'}`} onClick={togglePublish}>
          <Icon name={live ? 'x' : 'send'} />{live ? (scheduled ? 'Unschedule' : 'Unpublish') : 'Publish'}
        </button>
      </header>
      {focus && <button className="focus-exit" onClick={() => setFocus(false)}>Exit focus · Esc</button>}

      {err && <div className="banner">{err}<button className="icon-btn" onClick={() => setErr('')}><Icon name="x" /></button></div>}
      {recover && (
        <div className="banner info">
          <span>Found unsaved changes from {new Date(recover.t).toLocaleString()} that never reached the server.</span>
          <button className="btn sm" onClick={() => { editor.commands.setContent(recover.json as never); metaRef.current = recover.meta; setMetaRaw(recover.meta); setRecover(null); schedule(); }}>Restore them</button>
          <button className="btn ghost sm" onClick={() => { try { localStorage.removeItem(BK); } catch { /* */ } setRecover(null); }}>Discard</button>
        </div>
      )}

      <div className="split">
        <main className="paper">
          <div className="toolbar" hidden={!!preview}>
            {tb('bold', editor.isActive('bold'), () => c().toggleBold().run(), 'Bold (⌘B)')}
            {tb('italic', editor.isActive('italic'), () => c().toggleItalic().run(), 'Italic (⌘I)')}
            {tb('underline', editor.isActive('underline'), () => c().toggleUnderline().run(), 'Underline (⌘U)')}
            {tb('strike', editor.isActive('strike'), () => c().toggleStrike().run(), 'Strikethrough')}
            {tb('highlight', editor.isActive('highlight'), () => c().toggleHighlight().run(), 'Highlight')}
            {tb('code', editor.isActive('code'), () => c().toggleCode().run(), 'Inline code')}
            <i />
            {tb('', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), 'Heading 2', 'H2')}
            {tb('', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), 'Heading 3', 'H3')}
            {tb('ul', editor.isActive('bulletList'), () => c().toggleBulletList().run(), 'Bulleted list')}
            {tb('ol', editor.isActive('orderedList'), () => c().toggleOrderedList().run(), 'Numbered list')}
            {tb('check', editor.isActive('taskList'), () => c().toggleTaskList().run(), 'Checklist')}
            {tb('quote', editor.isActive('blockquote'), () => c().toggleBlockquote().run(), 'Quote')}
            {tb('codeblock', editor.isActive('codeBlock'), () => c().toggleCodeBlock().run(), 'Code block')}
            <i />
            {tb('link', editor.isActive('link'), openLink, 'Link (⌘K)')}
            {tb('image', false, () => fileInput.current?.click(), 'Insert image')}
            {tb('table', false, () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 'Insert table')}
            {tb('callout', inCallout, () => c().insertContent({ type: 'callout', attrs: { kind: 'info' }, content: [{ type: 'paragraph' }] }).run(), 'Callout')}
            <span className="grow" />
            {tb('undo', false, () => c().undo().run(), 'Undo (⌘Z)')}
            {tb('redo', false, () => c().redo().run(), 'Redo (⌘⇧Z)')}
          </div>

          {preview && (
            <div className="preview-bar">
              <div className="seg sm">
                <button className={preview === 'desktop' ? 'on' : ''} onClick={() => setPreview('desktop')}>Desktop</button>
                <button className={preview === 'mobile' ? 'on' : ''} onClick={() => setPreview('mobile')}>Mobile</button>
              </div>
              <span className="muted small">This is how readers will see it.</span>
            </div>
          )}

          <article className={`doc ${preview ? 'is-hidden' : ''}`}>
            {meta.cover_url && (
              <div className="cover-wrap">
                <img className="cover" src={meta.cover_url} alt={meta.cover_alt} />
                <div className="cover-actions">
                  <button className="btn sm" onClick={() => coverInput.current?.click()}>Change cover</button>
                  <button className="btn sm" onClick={() => setMeta({ cover_url: null })}>Remove</button>
                </div>
              </div>
            )}
            {!meta.cover_url && <button className="add-cover" onClick={() => coverInput.current?.click()}><Icon name="image" />Add cover image</button>}
            <textarea
              className="title-input"
              rows={1}
              placeholder="Untitled"
              value={meta.title === 'Untitled' ? '' : meta.title}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              onChange={(e) => setMeta({ title: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } }}
            />
            <EditorContent editor={editor} />
          </article>

          {preview && (
            <div className={`preview ${preview}`}>
              <div className="reader">
                <p className="reader-meta">{meta.category || 'Uncategorised'} · {mins} min read</p>
                <h1>{meta.title || 'Untitled'}</h1>
                {meta.cover_url && <img className="cover" src={meta.cover_url} alt={meta.cover_alt} />}
                <div className="body" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
              </div>
            </div>
          )}

          <BubbleMenu editor={editor} shouldShow={({ editor: e, state: s }) => !s.selection.empty && !e.isActive('image') && !e.isActive('codeBlock')}>
            <div className="bubble">
              {tb('bold', editor.isActive('bold'), () => c().toggleBold().run(), 'Bold')}
              {tb('italic', editor.isActive('italic'), () => c().toggleItalic().run(), 'Italic')}
              {tb('underline', editor.isActive('underline'), () => c().toggleUnderline().run(), 'Underline')}
              {tb('highlight', editor.isActive('highlight'), () => c().toggleHighlight().run(), 'Highlight')}
              {tb('code', editor.isActive('code'), () => c().toggleCode().run(), 'Code')}
              {tb('link', editor.isActive('link'), openLink, 'Link')}
              <i />
              {tb('', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run(), 'Heading 2', 'H2')}
              {tb('', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run(), 'Heading 3', 'H3')}
              {tb('quote', editor.isActive('blockquote'), () => c().toggleBlockquote().run(), 'Quote')}
            </div>
          </BubbleMenu>

          <FloatingMenu editor={editor} shouldShow={({ state: s }) => {
            const { $from, empty } = s.selection;
            return empty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0 && $from.depth === 1;
          }}>
            <button className="plus" onMouseDown={(e) => e.preventDefault()} onClick={() => c().insertContent('/').run()} title="Insert a block"><Icon name="plus" size={16} /></button>
          </FloatingMenu>

          {/* contextual bars: only one shows at a time */}
          {linkBar !== null ? (
            <form className="ctxbar" onSubmit={(e) => { e.preventDefault(); applyLink(linkBar); }}>
              <Icon name="link" />
              <input autoFocus placeholder="Paste or type a link — empty removes it" value={linkBar} onChange={(e) => setLinkBar(e.target.value)} />
              <button className="btn primary sm">Apply</button>
              <button type="button" className="btn ghost sm" onClick={() => setLinkBar(null)}>Cancel</button>
            </form>
          ) : imageAttrs ? (
            <div className="ctxbar">
              <Icon name="image" />
              <input placeholder="Alt text — describe the image" value={(imageAttrs.alt as string) || ''} onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()} />
              <input placeholder="Caption (optional)" value={(imageAttrs.title as string) || ''} onChange={(e) => editor.chain().updateAttributes('image', { title: e.target.value }).run()} />
              <span className="seg sm">
                {([[50, 'S'], [75, 'M'], [null, 'Full']] as [number | null, string][]).map(([w, l]) => (
                  <button key={l} className={(imageAttrs.width ?? null) === w ? 'on' : ''} onClick={() => editor.chain().updateAttributes('image', { width: w }).run()}>{l}</button>
                ))}
              </span>
              <button className="icon-btn" title="Delete image" onClick={() => c().deleteSelection().run()}><Icon name="trash" /></button>
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
            <div className="seg full">
              <button className={panel === 'settings' ? 'on' : ''} onClick={() => setPanel('settings')}><Icon name="sliders" />Settings</button>
              <button className={panel === 'outline' ? 'on' : ''} onClick={() => setPanel('outline')}><Icon name="outline" />Outline</button>
            </div>

            {panel === 'outline' ? (
              <div className="outline">
                {!headings.length && <p className="muted small">Add H2 / H3 headings and they show up here for quick navigation.</p>}
                {headings.map((h) => (
                  <button key={h.pos} style={{ paddingLeft: 8 + (h.level - 2) * 14 }} onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}>
                    <span className="lv">H{h.level}</span>{h.text || '(empty heading)'}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <section className="group">
                  <label>Excerpt <small className={meta.excerpt.length > 160 ? 'over' : ''}>{meta.excerpt.length}/160</small>
                    <textarea rows={3} value={meta.excerpt} placeholder="One or two sentences that sell the post" onChange={(e) => setMeta({ excerpt: e.target.value })} />
                  </label>
                  <label>Category
                    <input list="cat-list" value={meta.category} placeholder="Flutter, Programming…" onChange={(e) => setMeta({ category: e.target.value })} />
                    <datalist id="cat-list">{cats.map((x) => <option key={x} value={x} />)}</datalist>
                  </label>
                  <div className="field">Tags<TagInput value={meta.tags} onChange={(tags) => setMeta({ tags })} /></div>
                </section>

                <section className="group">
                  <div className="field">Cover image
                    <CoverField url={meta.cover_url} alt={meta.cover_alt}
                      onPick={() => coverInput.current?.click()}
                      onDrop={async (f) => { try { setMeta({ cover_url: await uploadImage(f) }); } catch (x) { setErr('Upload failed: ' + (x as Error).message); } }}
                      onRemove={() => setMeta({ cover_url: null })}
                      onAlt={(a) => setMeta({ cover_alt: a })}
                      firstImage={(() => { let s = ''; editor.state.doc.descendants((n) => { if (!s && n.type.name === 'image') s = n.attrs.src; }); return s; })()}
                      onUseFirst={(src) => setMeta({ cover_url: src })} />
                  </div>
                </section>

                <section className="group">
                  <label>URL slug
                    <input value={meta.slug} onChange={(e) => setMeta({ slug: slugify(e.target.value) })} />
                    <small className="hint">teewrath.github.io/post.html?id={meta.slug}</small>
                  </label>
                  <label>Publish date <small>future date = scheduled</small>
                    <input type="datetime-local" value={toLocalInput(meta.published_at)} onChange={(e) => setMeta({ published_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                  </label>
                </section>

                <section className="group">
                  <h3>Search & sharing</h3>
                  <label>SEO title <small className={(meta.seo_title || meta.title).length > 60 ? 'over' : ''}>{(meta.seo_title || meta.title).length}/60</small>
                    <input value={meta.seo_title} placeholder={meta.title} onChange={(e) => setMeta({ seo_title: e.target.value })} />
                  </label>
                  <label>SEO description <small className={(meta.seo_desc || meta.excerpt).length > 160 ? 'over' : ''}>{(meta.seo_desc || meta.excerpt).length}/160</small>
                    <textarea rows={3} value={meta.seo_desc} placeholder={meta.excerpt} onChange={(e) => setMeta({ seo_desc: e.target.value })} />
                  </label>
                  <div className="serp">
                    <span>teewrath.github.io › post › {meta.slug}</span>
                    <b>{meta.seo_title || meta.title || 'Untitled'}</b>
                    <p>{meta.seo_desc || meta.excerpt || 'Add an excerpt or SEO description.'}</p>
                  </div>
                  <div className="ogcard">
                    <div className="og-img" style={meta.cover_url ? { backgroundImage: `url("${meta.cover_url}")` } : undefined}>{!meta.cover_url && <Icon name="image" size={22} />}</div>
                    <div><small>teewrath.github.io</small><b>{meta.seo_title || meta.title || 'Untitled'}</b></div>
                  </div>
                </section>
              </>
            )}
          </aside>
        )}
      </div>

      <footer className="statusbar">
        <span>{words.toLocaleString()} words</span>
        <span>{chars.toLocaleString()} characters</span>
        <span>{mins} min read</span>
        {selWords > 0 && <span className="sel">{selWords} selected</span>}
        <span className="grow" />
        <button onClick={() => emit('shortcuts')}><Icon name="keyboard" size={14} />?</button>
      </footer>

      {slash && slash.rect && slash.items.length > 0 && (
        <ul className="slash" style={{ top: Math.min(slash.rect.bottom + 6, innerHeight - 360), left: Math.min(slash.rect.left, innerWidth - 280) }}>
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

function TagInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="tags" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement).focus()}>
      {value.map((t) => (
        <span key={t} className="tag">{t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>×</button></span>
      ))}
      <input
        value={draft}
        placeholder={value.length ? '' : 'Add a tag, press Enter'}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}

function CoverField({ url, alt, onPick, onDrop, onRemove, onAlt, firstImage, onUseFirst }: {
  url: string | null; alt: string; onPick: () => void; onDrop: (f: File) => void; onRemove: () => void; onAlt: (a: string) => void; firstImage: string; onUseFirst: (s: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="cover-field">
      {url ? (
        <div className="cover-preview" style={{ backgroundImage: `url("${url}")` }}>
          <div><button className="btn sm" onClick={onPick}>Replace</button><button className="btn sm" onClick={onRemove}>Remove</button></div>
        </div>
      ) : (
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onClick={onPick}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) onDrop(f); }}
        >
          <Icon name="upload" size={20} /><span>Drop an image or click to upload</span>
          {firstImage && <button className="btn sm" onClick={(e) => { e.stopPropagation(); onUseFirst(firstImage); }}>Use first image in post</button>}
        </div>
      )}
      {url && <input value={alt} placeholder="Cover alt text" onChange={(e) => onAlt(e.target.value)} />}
    </div>
  );
}

function PublishDialog({ editor, meta, onClose, onConfirm }: { editor: NonNullable<ReturnType<typeof useEditor>>; meta: Meta; onClose: () => void; onConfirm: (iso: string | null) => void }) {
  const future = !!meta.published_at && new Date(meta.published_at) > new Date();
  const [when, setWhen] = useState<'now' | 'later'>(future ? 'later' : 'now');
  const [at, setAt] = useState(toLocalInput(future ? meta.published_at : new Date(Date.now() + 3600e3).toISOString()));

  const words = editor.storage.characterCount.words() as number;
  let imgs = 0, noAlt = 0, prev = 1, skipped = false;
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image') { imgs++; if (!n.attrs.alt) noAlt++; }
    if (n.type.name === 'heading') { if (n.attrs.level > prev + 1 && prev !== 1) skipped = true; if (prev === 1 && n.attrs.level > 2) skipped = true; prev = n.attrs.level; }
  });
  const sentences = editor.getText().split(/[.!?]+\s/).filter((s) => s.trim());
  const avg = sentences.length ? words / sentences.length : 0;
  const checks: [boolean, string][] = [
    [!!meta.title.trim() && meta.title !== 'Untitled', 'Has a real title'],
    [words >= 150, `Has substance (${words} words)`],
    [meta.excerpt.trim().length >= 40, 'Excerpt written (shows on the blog list)'],
    [!!meta.cover_url, 'Cover image set'],
    [!!meta.category, 'Category chosen'],
    [noAlt === 0, imgs ? `All ${imgs} image(s) have alt text` : 'Images have alt text'],
    [!skipped, 'Heading levels don’t skip (H2 → H3 → H4)'],
    [avg <= 26, `Readable sentences (avg ${avg.toFixed(0)} words)`],
  ];
  const todo = checks.filter(([ok]) => !ok).length;

  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{todo ? 'Almost there' : 'Ready to publish'}</h2>
        <ul className="checks">
          {checks.map(([ok, t]) => <li key={t} className={ok ? 'ok' : 'no'}><span>{ok ? '✓' : '○'}</span>{t}</li>)}
        </ul>
        {todo > 0 && <p className="muted small">{todo} thing{todo === 1 ? '' : 's'} could be better — you can still publish.</p>}
        <div className="seg">
          <button className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}><Icon name="send" />Publish now</button>
          <button className={when === 'later' ? 'on' : ''} onClick={() => setWhen('later')}><Icon name="clock" />Schedule</button>
        </div>
        {when === 'later' && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Keep editing</button>
          <button className="btn primary" onClick={() => onConfirm(when === 'later' && at ? new Date(at).toISOString() : null)}>
            {when === 'later' ? 'Schedule post' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
