'use strict';

/* project.js — renders a single project "launch page" from projects/projects.json
   (+ optional Markdown body), with share and per-project Giscus comments/reactions. */

(function () {
  const root = document.documentElement;
  const wrap = document.querySelector('[data-project]');
  const cfg = window.GISCUS || {};
  const giscusTheme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'transparent_dark');

  /* theme toggle (+ keep giscus in sync) */
  const tbtn = document.querySelector('[data-theme-toggle]');
  if (tbtn) tbtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    const frame = document.querySelector('iframe.giscus-frame');
    if (frame) frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
  });

  /* cursor glow */
  const glow = document.querySelector('.cursor-glow');
  if (glow && matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, on = false;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; if (!on) { glow.style.opacity = '1'; on = true; } });
    (function loop(){ cx += (x-cx)*0.12; cy += (y-cy)*0.12; glow.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); })();
  }

  /* reading progress */
  const bar = document.querySelector('[data-progress]');
  if (bar) addEventListener('scroll', () => {
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }, { passive: true });

  /* toast + share */
  let toastEl;
  const toast = (msg) => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'proj-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    requestAnimationFrame(() => { toastEl.style.opacity = '1'; toastEl.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.style.opacity = '0'; toastEl.style.transform = 'translateX(-50%) translateY(10px)'; }, 1800);
  };
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

  const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

  const linkBtns = (p) => {
    const out = [];
    if (p.repo)  out.push(`<a class="proj-btn primary" href="${esc(p.repo)}" target="_blank" rel="noopener"><ion-icon name="logo-github"></ion-icon> Source</a>`);
    if (p.demo)  out.push(`<a class="proj-btn" href="${esc(p.demo)}" target="_blank" rel="noopener"><ion-icon name="globe-outline"></ion-icon> Live</a>`);
    if (p.watch) out.push(`<a class="proj-btn" href="${esc(p.watch)}" target="_blank" rel="noopener"><ion-icon name="logo-youtube"></ion-icon> Watch</a>`);
    (p.links || []).forEach((l) => out.push(`<a class="proj-btn" href="${esc(l.url)}" target="_blank" rel="noopener"><ion-icon name="open-outline"></ion-icon> ${esc(l.label || 'Visit')}</a>`));
    out.push(`<button class="proj-share" data-share type="button"><ion-icon name="share-social-outline"></ion-icon> Share</button>`);
    return out.join('');
  };

  const techChips = (p) =>
    (p.tech && p.tech.length)
      ? `<div class="proj-tech">${p.tech.map((t) => `<span class="tech-chip">${esc(t)}</span>`).join('')}</div>`
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
      const cover = p.cover ? `<img class="proj-cover" src="${esc(p.cover)}" alt="${esc(p.title)}" />` : '';
      const bodyHtml = md && window.marked
        ? `<hr class="proj-hr" /><div class="proj-body">${window.marked.parse(md)}</div>`
        : '';
      wrap.innerHTML = `
        <div class="proj-hero">
          <div>
            <p class="proj-cat">${esc(p.category || 'Project')}</p>
            <h1 class="proj-title">${esc(p.title)}</h1>
            <p class="proj-tagline">${esc(p.excerpt || '')}</p>
            <div class="proj-actions">${linkBtns(p)}</div>
            ${techChips(p)}
          </div>
          ${cover}
        </div>
        ${bodyHtml}
        <div class="proj-footer">
          <a href="./index.html#projects">&#8592; All projects</a>
          <a href="./index.html#contact">Work with me &#8594;</a>
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
      wrap.innerHTML = '<p class="proj-state">Project not found. <a href="./index.html#projects" style="color:var(--accent)">Back to projects</a>.</p>';
    });
})();
