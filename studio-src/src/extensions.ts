import { Node, Extension, mergeAttributes, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';

// Highlighted note box:  <div data-callout="info">…</div>
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-callout') || 'info',
        renderHTML: (a) => ({ 'data-callout': a.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'callout' }, HTMLAttributes), 0];
  },
});

export interface SlashItem {
  title: string;
  hint: string;
  keywords: string;
  run: (editor: Editor, range: Range) => void;
}

export interface SlashUI {
  start: (p: SuggestionProps<SlashItem>) => void;
  update: (p: SuggestionProps<SlashItem>) => void;
  key: (e: KeyboardEvent) => boolean;
  exit: () => void;
}

export function buildItems(pickImage: () => void): SlashItem[] {
  const c = (e: Editor, r: Range) => e.chain().focus().deleteRange(r);
  return [
    { title: 'Heading 2', hint: 'Section title', keywords: 'h2 heading title', run: (e, r) => c(e, r).setNode('heading', { level: 2 }).run() },
    { title: 'Heading 3', hint: 'Sub-section', keywords: 'h3 heading subtitle', run: (e, r) => c(e, r).setNode('heading', { level: 3 }).run() },
    { title: 'Bulleted list', hint: 'Simple list', keywords: 'ul bullet list', run: (e, r) => c(e, r).toggleBulletList().run() },
    { title: 'Numbered list', hint: 'Ordered steps', keywords: 'ol number list', run: (e, r) => c(e, r).toggleOrderedList().run() },
    { title: 'Checklist', hint: 'To-do items', keywords: 'todo task check', run: (e, r) => c(e, r).toggleTaskList().run() },
    { title: 'Quote', hint: 'Pull quote', keywords: 'blockquote quote', run: (e, r) => c(e, r).toggleBlockquote().run() },
    { title: 'Code block', hint: 'Syntax highlighted', keywords: 'code pre snippet', run: (e, r) => c(e, r).toggleCodeBlock().run() },
    { title: 'Image', hint: 'Upload from your computer', keywords: 'image photo picture upload', run: (e, r) => { c(e, r).run(); pickImage(); } },
    { title: 'Callout', hint: 'Highlighted note', keywords: 'callout note tip info warning', run: (e, r) => c(e, r).insertContent({ type: 'callout', attrs: { kind: 'info' }, content: [{ type: 'paragraph' }] }).run() },
    { title: 'Table', hint: '3×3 table', keywords: 'table grid', run: (e, r) => c(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    {
      title: 'YouTube', hint: 'Embed a video', keywords: 'youtube video embed',
      run: (e, r) => {
        const src = prompt('YouTube URL');
        if (src) c(e, r).setYoutubeVideo({ src }).run();
        else c(e, r).run();
      },
    },
    { title: 'Divider', hint: 'Horizontal rule', keywords: 'hr divider line separator', run: (e, r) => c(e, r).setHorizontalRule().run() },
  ];
}

export function SlashCommand(ui: { current: SlashUI | null }, items: () => SlashItem[]) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return items().filter((i) => (i.title + ' ' + i.keywords).toLowerCase().includes(q));
          },
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => ({
            onStart: (p) => ui.current?.start(p),
            onUpdate: (p) => ui.current?.update(p),
            onKeyDown: ({ event }) => ui.current?.key(event) ?? false,
            onExit: () => ui.current?.exit(),
          }),
        }),
      ];
    },
  });
}
