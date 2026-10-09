import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
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
import { supabase, uploadImage, slugify, type Post } from './supabase';
import { Callout, SlashCommand, buildItems, type SlashItem, type SlashUI } from './extensions';
import type { SuggestionProps } from '@tiptap/suggestion';

const lowlight = createLowlight(common);
type Meta = Pick<Post, 'title' | 'slug' | 'excerpt' | 'category' | 'tags' | 'cover_url' | 'cover_alt' | 'seo_title' | 'seo_desc' | 'status' | 'published_at'>;
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function EditorPage({ id }: { id: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [initial, setInitial] = useState<unknown>(null);
  const [state, setState] = useState<SaveState>('saved');
  const [msg, setMsg] = useState('');
  const [panel, setPanel] = useState(true);

  useEffect(() => {
    supabase.from('posts').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) return setMsg(error?.message || 'Post not found');
      const p = data as Post;
      setInitial(p.content_json ?? p.content_html ?? '');
      setMeta({ title: p.title, slug: p.slug, excerpt: p.excerpt, category: p.category, tags: p.tags, cover_url: p.cover_url, cover_alt: p.cover_alt, seo_title: p.seo_title, seo_desc: p.seo_desc, status: p.status, published_at: p.published_at });
    });
  }, [id]);

  if (!meta) return <div className="boot">{msg || 'Loading…'}</div>;
  return <Editor id={id} initialMeta={meta} initialContent={initial} state={state} setState={setState} panel={panel} setPanel={setPanel} />;
}

interface Props {
  id: string;
  initialMeta: Meta;
  initialContent: unknown;
  state: SaveState;
  setState: (s: SaveState) => void;
  panel: boolean;
  setPanel: (b: boolean) => void;
}

function Editor({ id, initialMeta, initialContent, state, setState, panel, setPanel }: Props) {
  const [meta, setMetaRaw] = useState<Meta>(initialMeta);
  const metaRef = useRef(meta);
  const timer = useRef<number | undefined>(undefined);
  const saving = useRef(false);
  const again = useRef(false);
  const slugAuto = useRef(initialMeta.slug.startsWith('untitled-') || initialMeta.slug === slugify(initialMeta.title));
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [slash, setSlash] = useState<{ items: SlashItem[]; rect: DOMRect | null; index: number; run: (i: SlashItem) => void } | null>(null);
  const slashRef = useRef(slash);
  slashRef.current = slash;
  const slashUI = useRef<SlashUI | null>(null);
  const uploadRef = useRef<(f: File, pos?: number) => void>(() => {});

  const items = useMemo(() => buildItems(() => fileInput.current?.click()), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true } }),
      Image.configure({ allowBase64: false }),
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
      attributes: { class: 'prose' },
      handleDrop: (view, ev) => {
        const f = ev.dataTransfer?.files?.[0];
        if (!f || !f.type.startsWith('image/')) return false;
        ev.preventDefault();
        const pos = view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos;
        uploadRef.current(f, pos);
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

  // Slash-menu bridge between the TipTap suggestion plugin and React state.
  useEffect(() => {
    const toState = (p: SuggestionProps<SlashItem>) =>
      setSlash((s) => ({ items: p.items, rect: p.clientRect?.() ?? null, index: Math.min(s?.index ?? 0, Math.max(0, p.items.length - 1)), run: (i) => p.command(i) }));
    slashUI.current = {
      start: (p) => setSlash({ items: p.items, rect: p.clientRect?.() ?? null, index: 0, run: (i) => p.command(i) }),
      update: toState,
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

  uploadRef.current = async (file, pos) => {
    if (!editor) return;
    setErr('Uploading image…');
    try {
      const src = await uploadImage(file);
      const chain = editor.chain().focus();
      if (pos != null) chain.setTextSelection(pos);
      chain.setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
      setErr('');
    } catch (e) {
      setErr('Upload failed: ' + (e as Error).message);
    }
  };

  const save = useCallback(async () => {
    if (!editor) return;
    if (saving.current) { again.current = true; return; }
    saving.current = true;
    setState('saving');
    const m = metaRef.current;
    const words = editor.storage.characterCount.words();
    const payload = {
      ...m,
      slug: m.slug || 'untitled-' + id.slice(0, 6),
      content_json: editor.getJSON(),
      content_html: editor.getHTML(),
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
    if (again.current) { again.current = false; schedule(); } else setState('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, id]);

  function schedule() {
    setState('dirty');
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

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (state === 'dirty' || state === 'saving') e.preventDefault(); };
    addEventListener('beforeunload', on);
    return () => removeEventListener('beforeunload', on);
  }, [state]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const publish = async () => {
    const wasLive = metaRef.current.status === 'published';
    const at = metaRef.current.published_at || new Date().toISOString();
    metaRef.current = { ...metaRef.current, status: wasLive ? 'draft' : 'published', published_at: wasLive ? metaRef.current.published_at : at };
    setMetaRaw(metaRef.current);
    clearTimeout(timer.current);
    await save();
  };

  const back = async () => {
    clearTimeout(timer.current);
    if (state === 'dirty') await save();
    location.hash = '#/';
  };

  const words = useEditorState({ editor, selector: (s) => s.editor?.storage.characterCount.words() ?? 0 });
  const live = meta.status === 'published';
  const scheduled = live && meta.published_at && new Date(meta.published_at) > new Date();

  const linkPrompt = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = prompt('Link URL (empty to remove)', prev || 'https://');
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const pickCover = async (f?: File) => {
    if (!f) return;
    try { setMeta({ cover_url: await uploadImage(f) }); } catch (e) { setErr('Upload failed: ' + (e as Error).message); }
  };

  if (!editor) return null;
  const btn = (label: string, active: boolean, run: () => void, title?: string) => (
    <button type="button" className={active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={run} title={title}>{label}</button>
  );
  const img = editor.isActive('image') ? editor.getAttributes('image') : null;

  return (
    <div className="shell">
      <header className="topbar">
        <button className="btn ghost" onClick={back}>← Posts</button>
        <span className={`save ${state}`}>{{ saved: 'Saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Save failed' }[state]}</span>
        <span className="spacer" />
        <span className="muted">{words} words · {Math.max(1, Math.round(words / 220))} min</span>
        <button className="btn ghost" onClick={() => setPanel(!panel)}>{panel ? 'Hide settings' : 'Settings'}</button>
        {live && !scheduled && <a className="btn ghost" href={`../post.html?id=${encodeURIComponent(meta.slug)}`} target="_blank" rel="noopener">View ↗</a>}
        <button className="btn primary" onClick={publish}>{live ? 'Unpublish' : meta.published_at && new Date(meta.published_at) > new Date() ? 'Schedule' : 'Publish'}</button>
      </header>
      {err && <div className="banner">{err}</div>}

      <div className="split">
        <main className="paper">
          <div className="toolbar">
            {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
            {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
            {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline')}
            {btn('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough')}
            {btn('Hi', editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run(), 'Highlight')}
            {btn('</>', editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Inline code')}
            <i />
            {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            {btn('H3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
            {btn('• List', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
            {btn('1. List', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
            {btn('☑', editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Checklist')}
            {btn('❝', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
            {btn('Code', editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Code block')}
            <i />
            {btn('Link', editor.isActive('link'), linkPrompt)}
            {btn('Image', false, () => fileInput.current?.click())}
            {btn('Table', false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
            {btn('Callout', editor.isActive('callout'), () => editor.chain().focus().insertContent({ type: 'callout', attrs: { kind: 'info' }, content: [{ type: 'paragraph' }] }).run())}
            <i />
            {btn('↶', false, () => editor.chain().focus().undo().run(), 'Undo')}
            {btn('↷', false, () => editor.chain().focus().redo().run(), 'Redo')}
          </div>

          <article className="doc">
            <textarea
              className="title-input"
              rows={1}
              placeholder="Post title"
              value={meta.title}
              onChange={(e) => { setMeta({ title: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />
            {meta.cover_url && <img className="cover" src={meta.cover_url} alt={meta.cover_alt} />}
            <EditorContent editor={editor} />
          </article>

          <BubbleMenu editor={editor} shouldShow={({ editor: e, state: s }) => !s.selection.empty && !e.isActive('image') && !e.isActive('codeBlock')}>
            <div className="bubble">
              {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
              {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
              {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
              {btn('Hi', editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run())}
              {btn('</>', editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
              {btn('Link', editor.isActive('link'), linkPrompt)}
              {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            </div>
          </BubbleMenu>

          {img && (
            <div className="imagebar">
              <input placeholder="Alt text (for accessibility & SEO)" value={img.alt || ''} onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()} />
              <input placeholder="Caption (optional)" value={img.title || ''} onChange={(e) => editor.chain().updateAttributes('image', { title: e.target.value }).run()} />
            </div>
          )}
        </main>

        {panel && (
          <aside className="side">
            <h3>Post settings</h3>
            <label>URL slug
              <input value={meta.slug} onChange={(e) => setMeta({ slug: slugify(e.target.value) })} />
              <small>/post.html?id={meta.slug}</small>
            </label>
            <label>Category
              <input value={meta.category} placeholder="Flutter, Programming…" onChange={(e) => setMeta({ category: e.target.value })} />
            </label>
            <label>Tags <small>comma separated</small>
              <input value={meta.tags.join(', ')} onChange={(e) => setMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            </label>
            <label>Excerpt
              <textarea rows={3} value={meta.excerpt} placeholder="Shown on the blog list and link previews" onChange={(e) => setMeta({ excerpt: e.target.value })} />
              <small>{meta.excerpt.length}/160</small>
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
            <label>Publish date <small>future date = scheduled</small>
              <input type="datetime-local" value={toLocalInput(meta.published_at)} onChange={(e) => setMeta({ published_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </label>
            <h3>SEO</h3>
            <label>SEO title
              <input value={meta.seo_title} placeholder={meta.title} onChange={(e) => setMeta({ seo_title: e.target.value })} />
            </label>
            <label>SEO description
              <textarea rows={3} value={meta.seo_desc} placeholder={meta.excerpt} onChange={(e) => setMeta({ seo_desc: e.target.value })} />
            </label>
            <p className="muted small">Status: <b>{scheduled ? 'scheduled' : meta.status}</b></p>
          </aside>
        )}
      </div>

      {slash && slash.rect && slash.items.length > 0 && (
        <ul className="slash" style={{ top: slash.rect.bottom + 6, left: Math.min(slash.rect.left, innerWidth - 270) }}>
          {slash.items.map((it, i) => (
            <li key={it.title} className={i === slash.index ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); slash.run(it); }}>
              <b>{it.title}</b><span>{it.hint}</span>
            </li>
          ))}
        </ul>
      )}

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRef.current(f); e.target.value = ''; }} />
      <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
