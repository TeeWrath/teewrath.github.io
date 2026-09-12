'use strict';

/* ==========================================================================
   app.js — interface
   theme · top bar + scroll spy · drawer · project filters · contact form
   command palette (⌘K) · toast
   ========================================================================== */

(function () {
  /* ---------------------------------------------------------------- utils */
  const qs = (sel, scope) => (scope || document).querySelector(sel);
  const qsa = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- toast */
  let toastEl;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('on'));
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('on'), 1900);
  };

  /* ---------------------------------------------------------------- theme */
  const themeBtn = qs('[data-theme-toggle]');
  const setTheme = (next) => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    const meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#fafafa' : '#0a0a0a');
  };
  const toggleTheme = () => setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  /* ---------------------------------------------------------------- year */
  const year = qs('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------- top bar + scroll spy */
  const topbar = qs('[data-topbar]');
  const navLinks = qsa('[data-nav-link]');
  const sections = qsa('[data-section]');

  let activeId = null;
  const setActive = (id) => {
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach((l) => {
      const on = l.getAttribute('href') === '#' + id;
      l.classList.toggle('active', on);
      if (on) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (topbar) topbar.classList.toggle('stuck', scrollY > 8);

      // last section whose top has passed just below the bar
      const line = (topbar ? topbar.offsetHeight : 56) + 120;
      let current = null;
      sections.forEach((s) => {
        if (s.getBoundingClientRect().top <= line) current = s.id;
      });
      setActive(current);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------------------------------------------------------------- drawer */
  const drawerBtn = qs('[data-drawer-toggle]');
  const closeDrawer = () => {
    document.body.classList.remove('drawer-open', 'is-locked');
    if (drawerBtn) {
      drawerBtn.setAttribute('aria-expanded', 'false');
      drawerBtn.setAttribute('aria-label', 'Open menu');
    }
  };
  if (drawerBtn) {
    drawerBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('drawer-open');
      document.body.classList.toggle('is-locked', open);
      drawerBtn.setAttribute('aria-expanded', String(open));
      drawerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }
  // close first, then scroll: a native anchor jump while the body is
  // scroll-locked lands in the wrong place
  qsa('[data-drawer-link]').forEach((l) =>
    l.addEventListener('click', (e) => {
      const href = l.getAttribute('href') || '';
      if (!href.startsWith('#')) { closeDrawer(); return; }
      e.preventDefault();
      closeDrawer();
      requestAnimationFrame(() => {
        const target = qs(href);
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', href);
      });
    })
  );
  addEventListener('resize', () => {
    if (innerWidth > 800 && document.body.classList.contains('drawer-open')) closeDrawer();
  });

  /* ------------------------------------------------------ project filters */
  const filterBtns = qsa('[data-filter-btn]');
  const applyFilter = (value) => {
    const v = String(value).toLowerCase();
    qsa('[data-filter-item]').forEach((li) => {
      li.classList.toggle('hidden', !(v === 'all' || li.dataset.category === v));
    });
  };
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      applyFilter(btn.textContent.trim());
    });
  });

  /* ---------------------------------------------------------- contact form */
  const form = qs('[data-form]');
  const formBtn = qs('[data-form-btn]');
  if (form && formBtn) {
    const sync = () => {
      if (form.checkValidity()) formBtn.removeAttribute('disabled');
      else formBtn.setAttribute('disabled', '');
    };
    qsa('[data-form-input]', form).forEach((i) => {
      i.addEventListener('input', sync);
      i.addEventListener('blur', sync);
    });
  }

  /* -------------------------------------------------------- command palette */
  const cmdk = qs('[data-cmdk]');
  if (cmdk) {
    const input = qs('[data-cmdk-input]', cmdk);
    const list = qs('[data-cmdk-list]', cmdk);
    let lastFocus = null;
    let cursor = 0;
    let visible = [];

    const COMMANDS = [
      { group: 'Sections', label: 'About', hint: 'Jump', href: '#about' },
      { group: 'Sections', label: 'Experience', hint: 'Jump', href: '#experience' },
      { group: 'Sections', label: 'Projects', hint: 'Jump', href: '#projects' },
      { group: 'Sections', label: 'Sessions', hint: 'Jump', href: '#sessions' },
      { group: 'Sections', label: 'Blog', hint: 'Jump', href: '#blog' },
      { group: 'Sections', label: 'Contact', hint: 'Jump', href: '#contact' },

      { group: 'Links', label: 'View Résumé', hint: 'Open',
        href: 'https://drive.google.com/drive/folders/1ex4i0-DQcms5r-k4Vz_VuVopnX_t4C9b?usp=sharing', ext: true },
      { group: 'Links', label: 'Email — subroto.2003@gmail.com', hint: 'Mail', href: 'mailto:subroto.2003@gmail.com' },
      { group: 'Links', label: 'GitHub', hint: 'Open', href: 'https://github.com/TeeWrath', ext: true },
      { group: 'Links', label: 'LinkedIn', hint: 'Open', href: 'https://www.linkedin.com/in/subroto-banerjee-70983b214/', ext: true },
      { group: 'Links', label: 'Twitter', hint: 'Open', href: 'https://twitter.com/Subroto0108', ext: true },
      { group: 'Links', label: 'Instagram', hint: 'Open', href: 'https://instagram.com/subroto._banerjee', ext: true },
      { group: 'Links', label: 'Reddit', hint: 'Open', href: 'https://reddit.com/u/TeeWrath', ext: true },
      { group: 'Links', label: 'bio.link', hint: 'Open', href: 'https://bio.link/teewrath', ext: true },
      { group: 'Links', label: 'Mastodon', hint: 'Open', href: 'https://mastodon.social/@TeeWrath', ext: true },

      { group: 'Actions', label: 'Copy email address', hint: 'Copy',
        run: () => {
          const mail = 'subroto.2003@gmail.com';
          if (navigator.clipboard) navigator.clipboard.writeText(mail).then(() => toast('Email copied'));
          else toast(mail);
        } },
      { group: 'Actions', label: 'Toggle theme', hint: 'Switch', run: toggleTheme },
      { group: 'Actions', label: 'Back to top', hint: 'Scroll',
        run: () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }) },
    ];

    const render = (q) => {
      const needle = q.trim().toLowerCase();
      visible = COMMANDS.filter((c) => !needle || c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle));
      cursor = 0;

      if (!visible.length) {
        list.innerHTML = '<p class="cmdk-empty">Nothing matches that.</p>';
        return;
      }

      let html = '';
      let group = '';
      visible.forEach((c, i) => {
        if (c.group !== group) {
          group = c.group;
          html += `<p class="cmdk-group">${group}</p>`;
        }
        html +=
          `<button class="cmdk-item" type="button" data-i="${i}" aria-selected="${i === 0}">` +
          `<span>${c.label}</span><span class="hint">${c.hint}</span></button>`;
      });
      list.innerHTML = html;
    };

    const mark = () => {
      qsa('.cmdk-item', list).forEach((el) => {
        const on = Number(el.dataset.i) === cursor;
        el.setAttribute('aria-selected', String(on));
        if (on) el.scrollIntoView({ block: 'nearest' });
      });
    };

    const close = () => {
      cmdk.classList.remove('open');
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    };

    const open = () => {
      lastFocus = document.activeElement;
      closeDrawer();
      cmdk.classList.add('open');
      document.body.classList.add('is-locked');
      input.value = '';
      render('');
      setTimeout(() => input.focus(), 30);
    };

    const run = (cmd) => {
      if (!cmd) return;
      close();
      if (cmd.run) { cmd.run(); return; }
      if (cmd.ext) { window.open(cmd.href, '_blank', 'noopener'); return; }
      if (cmd.href.startsWith('#')) {
        const target = qs(cmd.href);
        if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', cmd.href);
        return;
      }
      location.href = cmd.href;
    };

    qsa('[data-cmdk-open]').forEach((b) => b.addEventListener('click', open));
    input.addEventListener('input', () => render(input.value));
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.cmdk-item');
      if (item) run(visible[Number(item.dataset.i)]);
    });
    cmdk.addEventListener('click', (e) => { if (e.target === cmdk) close(); });

    addEventListener('keydown', (e) => {
      const isOpen = cmdk.classList.contains('open');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        isOpen ? close() : open();
        return;
      }
      if (e.key === 'Escape') {
        if (isOpen) { e.preventDefault(); close(); }
        else if (document.body.classList.contains('drawer-open')) closeDrawer();
        return;
      }
      if (!isOpen || !visible.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % visible.length; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + visible.length) % visible.length; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(visible[cursor]); }
    });
  }

  /* ------------------------------------------------------------- lifecycle */
  // JSON renderers announce new nodes; section heights change, so re-spy
  document.addEventListener('content:updated', onScroll);

  window.UI = { toast };
})();
