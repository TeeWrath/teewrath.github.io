const GROUPS: [string, [string, string][]][] = [
  ['Writing', [
    ['/', 'Insert a block (heading, image, table…)'],
    ['⌘ B / I / U', 'Bold / italic / underline'],
    ['⌘ K', 'Add or edit a link'],
    ['⌘ Z / ⌘ ⇧ Z', 'Undo / redo'],
    ['⌘ S', 'Save now'],
    ['```', 'Start a code block'],
    ['> · - · 1.', 'Quote, bullets, numbered list'],
  ]],
  ['Studio', [
    ['⌘ P', 'Command palette — jump to any post'],
    ['⌘ ⇧ F', 'Focus mode'],
    ['⌘ ⇧ P', 'Toggle preview'],
    ['Esc', 'Close dialogs / leave focus mode'],
    ['?', 'This cheat sheet'],
    ['/ · N  (dashboard)', 'Search · new post'],
  ]],
];

export default function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal wide" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        <p className="muted small">Use Ctrl instead of ⌘ on Windows / Linux.</p>
        <div className="keys">
          {GROUPS.map(([g, rows]) => (
            <section key={g}>
              <h3>{g}</h3>
              {rows.map(([k, d]) => (
                <div key={k}><kbd>{k}</kbd><span>{d}</span></div>
              ))}
            </section>
          ))}
        </div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
