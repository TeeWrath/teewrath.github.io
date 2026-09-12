'use strict';

/* chrome.js — the chrome every page shares: skip link, top bar, mobile
   drawer, previous/next pager, footer and the command-palette shell.
   Navigation lives here and nowhere else.

   Load it as the first thing in <body> (it writes the header where it
   stands), then call Chrome.footer() where the footer belongs. A page names
   its nav item with <body data-page="…">; data-pager="off" hides the
   previous/next links (post and project pages). */

(function () {
  const PAGES = [
    { id: 'about', label: 'About', href: './index.html' },
    { id: 'experience', label: 'Experience', href: './experience.html' },
    { id: 'projects', label: 'Projects', href: './projects.html' },
    { id: 'sessions', label: 'Sessions', href: './sessions.html' },
    { id: 'blog', label: 'Blog', href: './blog.html' },
    { id: 'contact', label: 'Contact', href: './contact.html' },
  ];
  const RESUME = 'https://drive.google.com/drive/folders/1ex4i0-DQcms5r-k4Vz_VuVopnX_t4C9b?usp=sharing';
  const EMAIL = 'subroto.2003@gmail.com';

  const body = document.body;
  const current = body.dataset.page || '';
  const isHere = (p) => p.id === current;

  // the site used to be a single page: old index.html#section links land on the new pages
  if (current === 'about' && location.hash) {
    const moved = PAGES.find((p) => p.id !== 'about' && location.hash === '#' + p.id);
    if (moved) location.replace(moved.href);
  }

  const svg = (cls, inner) =>
    `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON_SEARCH = svg('', '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>');
  const ICON_MOON = svg('icon-moon', '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>');
  const ICON_SUN = svg('icon-sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');

  const navLinks = PAGES.map((p) =>
    isHere(p)
      ? `<a class="nav-link" href="${p.href}" aria-current="page">${p.label}<span class="nav-ind" aria-hidden="true"></span></a>`
      : `<a class="nav-link" href="${p.href}">${p.label}</a>`
  ).join('');

  const drawerLinks = PAGES.map((p, i) =>
    `<a class="drawer-link" href="${p.href}" style="--i:${i}"${isHere(p) ? ' aria-current="page"' : ''}>${p.label}</a>`
  ).join('');

  document.currentScript.insertAdjacentHTML('beforebegin', `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="topbar" data-topbar>
      <div class="wrap topbar-inner">
        <a class="brand" href="./index.html" aria-label="Subroto Banerjee — home">Subroto Banerjee</a>
        <nav class="nav" aria-label="Pages">${navLinks}</nav>
        <div class="bar-actions">
          <button class="icon-btn kbd-btn" data-cmdk-open type="button" aria-label="Search (⌘K)" title="Search  ⌘K">${ICON_SEARCH}</button>
          <button class="icon-btn theme-toggle" data-theme-toggle type="button" aria-label="Toggle dark / light theme" title="Toggle theme">${ICON_MOON}${ICON_SUN}</button>
          <a class="btn btn-primary btn-sm" href="./contact.html">Hire Me</a>
          <button class="icon-btn burger" data-drawer-toggle type="button" aria-label="Open menu" aria-expanded="false"><i></i><i></i></button>
        </div>
      </div>
    </header>
    <div class="drawer" data-drawer>
      ${drawerLinks}
      <div class="drawer-foot">
        <a href="mailto:${EMAIL}">${EMAIL}</a>
        <a href="${RESUME}" target="_blank" rel="noopener">View Résumé ↗</a>
        <a href="https://github.com/TeeWrath" target="_blank" rel="noopener">GitHub ↗</a>
        <a href="https://www.linkedin.com/in/subroto-banerjee-70983b214/" target="_blank" rel="noopener">LinkedIn ↗</a>
      </div>
    </div>`);

  const pager = () => {
    const i = PAGES.findIndex(isHere);
    if (i < 0 || body.dataset.pager === 'off') return '';
    const cell = (p, dir) =>
      `<a class="pager-link ${dir}" href="${p.href}">` +
      `<span class="pager-dir">${dir === 'prev' ? '← Previous' : 'Next →'}</span>` +
      `<span class="pager-name">${p.label}</span></a>`;
    const prev = PAGES[i - 1];
    const next = PAGES[i + 1];
    return `<nav class="wrap pager" aria-label="More pages">${prev ? cell(prev, 'prev') : ''}${next ? cell(next, 'next') : ''}</nav>`;
  };

  const footer = `
    <footer class="footer">
      <div class="wrap footer-inner">
        <p><span class="footer-name">Subroto Banerjee</span> — Builder | Creator — Agra, Uttar Pradesh, India</p>
        <nav class="footer-nav" aria-label="Footer">${PAGES.map((p) => `<a href="${p.href}">${p.label}</a>`).join('')}</nav>
        <div class="footer-base">
          <span>© <span data-year>2026</span> Subroto Banerjee</span>
          <a rel="me" href="https://mastodon.social/@TeeWrath" target="_blank">Mastodon</a>
          <a class="up" href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>

    <div class="cmdk" data-cmdk role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-panel">
        <div class="cmdk-field">
          ${ICON_SEARCH}
          <input type="text" placeholder="Jump to a page, or open a link…" data-cmdk-input aria-label="Search" />
          <kbd>ESC</kbd>
        </div>
        <div class="cmdk-list" data-cmdk-list></div>
      </div>
    </div>`;

  window.Chrome = {
    pages: PAGES,
    current,
    footer() {
      document.currentScript.insertAdjacentHTML('beforebegin', pager() + footer);
    },
  };
})();
