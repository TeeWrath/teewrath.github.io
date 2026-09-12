'use strict';

/* project.js — renders a single project page from projects/projects.json
   (+ optional Markdown body), with share and per-project Giscus comments/reactions.
   Theme, top bar, drawer and toast come from app.js. */

(function () {
  const root = document.documentElement;
  const wrap = document.querySelector('[data-project]');
  const cfg = window.GISCUS || {};
  const giscusTheme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'transparent_dark');

  /* keep giscus in step with the site theme (app.js owns the toggle) */
  document.addEventListener('theme:change', () => {
    const frame = document.querySelector('iframe.giscus-frame');
    if (frame) frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
  });

  /* reading progress */
  const bar = document.querySelector('[data-progress]');
  addEventListener('scroll', () => {
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, { passive: true });

  /* share */
  const toast = (msg) => window.UI && window.UI.toast(msg);
  const share = () => {
    const data = { title: document.title, url: location.href };
    if (navigator.share) navigator.share(data).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => toast('Link copied'));
    else prompt('Copy this link:', location.href);
  };

  /* giscus — one thread PER project */
  const mountGiscus = (container, id) => {
    if (!cfg.repoId || cfg.repoId.startsWith('REPLACE') || !cfg.categoryId || cfg.categoryId.startsWith('REPLACE')) {
      container.innerHTML =
        '<div class="comments-placeholder">Comments &amp; reactions are not wired up yet. ' +
        'Add your <code>repoId</code> and <code>categoryId</code> to <code>project.html</code>.</div>';
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js'; s.async = true; s.crossOrigin = 'anonymous';
    Object.assign(s.dataset, {
      repo: cfg.repo, repoId: cfg.repoId, category: cfg.category, categoryId: cfg.categoryId,
      mapping: 'specific', term: 'project: ' + id, strict: '1', reactionsEnabled: '1',
      emitMetadata: '0', inputPosition: 'top', theme: giscusTheme(), lang: 'en', loading: 'lazy'
    });
    container.appendChild(s);
  };

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const linkBtns = (p) => {
    const out = [];
    if (p.repo)  out.push(`<a class="proj-btn primary" href="${esc(p.repo)}" target="_blank" rel="noopener">Source ↗</a>`);
    if (p.demo)  out.push(`<a class="proj-btn" href="${esc(p.demo)}" target="_blank" rel="noopener">Live ↗</a>`);
    if (p.watch) out.push(`<a class="proj-btn" href="${esc(p.watch)}" target="_blank" rel="noopener">Watch ↗</a>`);
    (p.links || []).forEach((l) => out.push(`<a class="proj-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || 'Visit')} ↗</a>`));
    out.push(`<button class="proj-share" data-share type="button">Share</button>`);
    return out.join('');
  };

  const techList = (p) =>
    (p.tech && p.tech.length)
      ? `<div class="proj-tech enter" style="--i:4"><ul class="inline-list">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`
      : '';

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { wrap.innerHTML = '<p class="proj-state">No project specified.</p>'; return; }

  fetch('./projects/projects.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('projects.json ' + r.status); return r.json(); })
    .then((list) => {
      const p = list.find((x) => x.id === id);
      if (!p) throw new Error('not found');
      // optional long-form markdown body
      const bodyPromise = p.body
        ? fetch(p.body, { cache: 'no-cache' }).then((r) => (r.ok ? r.text() : '')).catch(() => '')
        : Promise.resolve('');
      return bodyPromise.then((md) => ({ p, md }));
    })
    .then(({ p, md }) => {
      document.title = p.title + ' — Subroto Banerjee';
      const cover = p.cover ? `<img class="proj-cover enter" style="--i:5" src="${esc(p.cover)}" alt="${esc(p.title)}" />` : '';
      const bodyHtml = md && window.marked
        ? `<hr class="proj-hr" /><div class="proj-body">${window.marked.parse(md)}</div>`
        : '';
      wrap.innerHTML = `
        <div class="proj-hero">
          <div>
            <p class="proj-cat enter" style="--i:0">${esc(p.category || 'Project')}</p>
            <h1 class="proj-title enter" style="--i:1">${esc(p.title)}</h1>
            <p class="proj-tagline enter" style="--i:2">${esc(p.excerpt || '')}</p>
            <div class="proj-actions enter" style="--i:3">${linkBtns(p)}</div>
            ${techList(p)}
          </div>
          ${cover}
        </div>
        ${bodyHtml}
        <div class="proj-footer">
          <a href="./projects.html">← All projects</a>
          <a href="./contact.html">Work with me →</a>
        </div>
        <section class="proj-comments">
          <p class="proj-comments-title">Reactions &amp; comments</p>
          <div data-giscus></div>
        </section>`;

      wrap.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', share));
      mountGiscus(wrap.querySelector('[data-giscus]'), p.id);
    })
    .catch((err) => {
      console.error(err);
      wrap.innerHTML = '<p class="proj-state">Project not found. <a href="./projects.html">Back to projects</a>.</p>';
    });
})();
