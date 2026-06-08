'use strict';

/* resume.js — Markdown-driven résumé: dialog + PDF + share.
   Works on index.html (dialog) and resume.html (full page).
   Single source of truth: resume.md  */

(function () {
  const RESUME_MD = './resume.md';
  const RESUME_URL = (location.origin && location.origin !== 'null')
    ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'resume.html'
    : './resume.html';
  const PDF_NAME = 'Subroto-Banerjee-Resume.pdf';

  // ---- lazy CDN loaders ----
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  const ensureMarked = () =>
    window.marked ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
  const ensureHtml2pdf = () =>
    window.html2pdf ? Promise.resolve()
      : loadScript('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js');

  // ---- render markdown into a target .rd-inner ----
  let mdCache = null;
  function fetchMd() {
    if (mdCache) return Promise.resolve(mdCache);
    return fetch(RESUME_MD, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error('resume.md ' + r.status);
      return r.text();
    }).then((t) => (mdCache = t));
  }

  function render(targetDoc) {
    const inner = targetDoc.querySelector('.rd-inner') || targetDoc;
    return Promise.all([ensureMarked(), fetchMd()])
      .then(([, md]) => { inner.innerHTML = window.marked.parse(md); })
      .catch((e) => {
        console.error(e);
        inner.innerHTML =
          '<p>Could not load résumé. If you opened this file directly, run a local server.</p>';
      });
  }

  // ---- print-friendly (light) styles for the PDF ----
  const PDF_CSS = `
    .resume-print { background:#fff; color:#1a1a1a; font-family:'Inter',Arial,sans-serif;
      padding:40px 46px; line-height:1.6; font-size:13px; width:760px; }
    .resume-print h1 { font-family:'Sora','Inter',sans-serif; font-size:26px; margin:0 0 4px; color:#0f0f0f; letter-spacing:-0.02em; }
    .resume-print h2 { font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#b07b1e;
      border-bottom:1px solid #e3ddd1; padding-bottom:5px; margin:24px 0 10px; }
    .resume-print h3 { font-size:14px; margin:14px 0 2px; color:#111; }
    .resume-print p, .resume-print li { font-size:13px; margin:4px 0; }
    .resume-print em { color:#555; font-style:normal; font-size:12px; }
    .resume-print ul { margin:6px 0; padding-left:18px; }
    .resume-print li { margin:3px 0; }
    .resume-print a { color:#b07b1e; text-decoration:none; }
    .resume-print strong { color:#000; }
    .resume-print hr { border:0; border-top:1px solid #e3ddd1; margin:14px 0; }
  `;

  function downloadPdf(sourceInner, btn) {
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = 'Building…'; btn.style.pointerEvents = 'none'; }
    Promise.all([ensureHtml2pdf(), ensureMarked(), fetchMd()])
      .then(([, , md]) => {
        const holder = document.createElement('div');
        holder.className = 'resume-print';
        const style = document.createElement('style');
        style.textContent = PDF_CSS;
        holder.appendChild(style);
        const body = document.createElement('div');
        body.innerHTML = window.marked.parse(md);
        holder.appendChild(body);

        // offscreen mount
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;left:-9999px;top:0;';
        wrap.appendChild(holder);
        document.body.appendChild(wrap);

        return window.html2pdf().set({
          margin: 0,
          filename: PDF_NAME,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css'] }
        }).from(holder).save().then(() => document.body.removeChild(wrap));
      })
      .catch((e) => { console.error(e); alert('PDF export failed. Try the Open → Print option.'); })
      .finally(() => { if (btn) { btn.innerHTML = original; btn.style.pointerEvents = ''; } });
  }

  function share() {
    const data = { title: 'Subroto Banerjee — Résumé', text: "Subroto Banerjee's résumé", url: RESUME_URL };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(RESUME_URL).then(() => toast('Résumé link copied'));
    } else {
      prompt('Copy this link:', RESUME_URL);
    }
  }

  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(10px);z-index:200;' +
        'font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.04em;padding:10px 16px;border-radius:10px;' +
        'background:var(--accent,#f0a843);color:var(--accent-ink,#1a1206);opacity:0;transition:.25s;pointer-events:none;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => { toastEl.style.opacity = '1'; toastEl.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.style.opacity = '0'; toastEl.style.transform = 'translateX(-50%) translateY(10px)'; }, 1800);
  }

  // ===== DIALOG MODE (index.html) =====
  const overlay = document.querySelector('[data-resume-overlay]');
  if (overlay) {
    const doc = overlay.querySelector('[data-resume-doc]');
    let rendered = false;
    const open = () => {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (!rendered) { rendered = true; render(doc); }
    };
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    document.querySelectorAll('[data-resume-open]').forEach((b) => b.addEventListener('click', open));
    overlay.querySelector('[data-resume-close]')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

    overlay.querySelector('[data-resume-pdf]')?.addEventListener('click', (e) =>
      downloadPdf(doc.querySelector('.rd-inner'), e.currentTarget));
    overlay.querySelector('[data-resume-share]')?.addEventListener('click', share);
  }

  // ===== PAGE MODE (resume.html) =====
  const page = document.querySelector('[data-resume-page]');
  if (page) {
    render(page);
    document.querySelector('[data-resume-pdf]')?.addEventListener('click', (e) =>
      downloadPdf(page.querySelector('.rd-inner'), e.currentTarget));
    document.querySelector('[data-resume-share]')?.addEventListener('click', share);
    document.querySelector('[data-resume-print]')?.addEventListener('click', () => window.print());
  }
})();
