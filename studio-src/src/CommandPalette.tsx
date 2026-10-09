import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { emit } from './bus';
import { Icon } from './icons';

interface Cmd { id: string; title: string; hint?: string; icon: string; run: () => void }

export default function CommandPalette({ onClose, inEditor }: { onClose: () => void; inEditor: boolean }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [posts, setPosts] = useState<{ id: string; title: string; status: string }[]>([]);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    supabase.from('posts').select('id,title,status').order('updated_at', { ascending: false }).then(({ data }) => setPosts((data as never) ?? []));
  }, []);

  const go = (fn: () => void) => () => { onClose(); setTimeout(fn, 0); };
  const cmds: Cmd[] = useMemo(() => {
    const base: Cmd[] = [
      { id: 'new', title: 'New post', hint: 'Start a blank draft', icon: 'plus', run: go(() => emit('new-post')) },
      { id: 'home', title: 'All posts', hint: 'Go to dashboard', icon: 'list', run: go(() => { location.hash = '#/'; }) },
      { id: 'theme', title: 'Cycle theme', hint: 'Auto · Light · Dark', icon: 'sun', run: go(() => emit('cycle-theme')) },
      { id: 'keys', title: 'Keyboard shortcuts', hint: '?', icon: 'keyboard', run: go(() => emit('shortcuts')) },
    ];
    const ed: Cmd[] = inEditor ? [
      { id: 'publish', title: 'Publish / unpublish', icon: 'send', run: go(() => emit('publish')) },
      { id: 'preview', title: 'Toggle preview', hint: '⌘⇧P', icon: 'eye', run: go(() => emit('preview')) },
      { id: 'focus', title: 'Focus mode', hint: '⌘⇧F', icon: 'focus', run: go(() => emit('focus')) },
      { id: 'settings', title: 'Post settings', icon: 'sliders', run: go(() => emit('panel', 'settings')) },
      { id: 'outline', title: 'Outline', icon: 'outline', run: go(() => emit('panel', 'outline')) },
      { id: 'md', title: 'Download as Markdown', icon: 'download', run: go(() => emit('export', 'md')) },
      { id: 'html', title: 'Download as HTML', icon: 'download', run: go(() => emit('export', 'html')) },
      { id: 'copyhtml', title: 'Copy HTML', icon: 'copy', run: go(() => emit('export', 'copy')) },
    ] : [];
    const jump: Cmd[] = posts.map((p) => ({ id: p.id, title: p.title || 'Untitled', hint: p.status, icon: 'file', run: go(() => { location.hash = `#/edit/${p.id}`; }) }));
    return [...ed, ...base, ...jump];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, inEditor]);

  const shown = useMemo(() => {
    const n = q.toLowerCase().trim();
    return (n ? cmds.filter((c) => c.title.toLowerCase().includes(n)) : cmds).slice(0, 40);
  }, [cmds, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => { (list.current?.children[idx] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); shown[idx]?.run(); }
    else if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-bg top" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" />
          <input autoFocus placeholder="Search posts or run a command…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} />
          <kbd>esc</kbd>
        </div>
        <ul ref={list}>
          {shown.map((c, i) => (
            <li key={c.id} className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); c.run(); }}>
              <Icon name={c.icon} /><span>{c.title}</span>{c.hint && <small>{c.hint}</small>}
            </li>
          ))}
          {!shown.length && <li className="none">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
