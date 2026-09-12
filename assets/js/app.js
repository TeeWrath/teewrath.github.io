'use strict';

/* ==========================================================================
   app.js — runtime shared by every page
   theme · top bar · drawer · reveals · on-page sub-nav · project filters
   contact form · copy buttons · command palette (⌘K) · toast
   Page-specific pieces only wire up when their markup is on the page.
   ========================================================================== */

(function () {
  /* ---------------------------------------------------------------- utils */
  const qs = (sel, scope) => (scope || document).querySelector(sel);
  const qsa = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = (key, n) => qsa(`[data-count="${key}"]`).forEach((el) => (el.textContent = n));

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
  const setTheme = (next) => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    const meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#fafafa' : '#0a0a0a');
    // pages with embeds (giscus) follow along
    document.dispatchEvent(new CustomEvent('theme:change', { detail: next }));
  };
  const toggleTheme = () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    // cross-fade the swap where the browser supports it
    if (document.startViewTransition && !reduceMotion) document.startViewTransition(() => setTheme(next));
    else setTheme(next);
  };
  qsa('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));

  /* ---------------------------------------------------------------- year */
  qsa('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

  /* ------------------------------------------------ top bar + sub-nav spy */
  const topbar = qs('[data-topbar]');
  const spy = qs('[data-spy]');
  const spyLinks = spy ? qsa('a[href^="#"]', spy) : [];
  const spyTargets = spyLinks.map((l) => document.getElementById(l.getAttribute('href').slice(1)));
  let spyActive = null;

  const updateSpy = () => {
    if (!spy) return;
    const line = (topbar ? topbar.offsetHeight : 56) + spy.offsetHeight + 64;
    let idx = 0;
    spyTargets.forEach((t, i) => {
      if (t && t.getBoundingClientRect().top <= line) idx = i;
    });
    // a short last block never reaches the line; at the bottom, it wins
    const doc = document.documentElement;
    if (scrollY > 0 && innerHeight + scrollY >= doc.scrollHeight - 4) idx = spyTargets.length - 1;

    const link = spyLinks[idx];
    if (!link || link === spyActive) return;
    spyActive = link;
    spyLinks.forEach((l) => {
      l.classList.toggle('active', l === link);
      if (l === link) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    // keep the active tab in view when the strip scrolls sideways
    if (spy.scrollWidth > spy.clientWidth) {
      spy.scrollTo({ left: Math.max(0, link.offsetLeft - 24), behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (topbar) topbar.classList.toggle('stuck', scrollY > 8);
      updateSpy();
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------------------------------------------------------------- drawer */
  const drawerBtn = qs('[data-drawer-toggle]');
  const setDrawer = (open) => {
    document.body.classList.toggle('drawer-open', open);
    document.body.classList.toggle('is-locked', open);
    if (drawerBtn) {
      drawerBtn.setAttribute('aria-expanded', String(open));
      drawerBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
  };
  const closeDrawer = () => setDrawer(false);
  if (drawerBtn) drawerBtn.addEventListener('click', () => setDrawer(!document.body.classList.contains('drawer-open')));
  qsa('[data-drawer] a').forEach((a) => a.addEventListener('click', closeDrawer));
  addEventListener('resize', () => {
    if (innerWidth > 800 && document.body.classList.contains('drawer-open')) closeDrawer();
  });

  /* --------------------------------------------------------------- reveals */
  // children of [data-reveal] rise in once as they enter the viewport;
  // core.css hides them only while this is running (see .reveal-ready)
  root.classList.add('reveal-ready');
  const io = !reduceMotion && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        let n = 0;
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.style.setProperty('--rd', Math.min(n++, 6) * 60 + 'ms');
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -6% 0px' })
    : null;

  const observeReveals = () => {
    qsa('[data-reveal] > :not(.state-line)').forEach((el) => {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      if (io) io.observe(el);
      else el.classList.add('in');
    });
  };

  // play the entrance again for items that just became visible (filters)
  const replay = (els) => {
    if (reduceMotion) return;
    els.forEach((el, i) => {
      el.style.transition = 'none';
      el.classList.remove('in');
      el.style.setProperty('--rd', Math.min(i, 8) * 35 + 'ms');
    });
    void document.body.offsetHeight; // commit the hidden state before animating back
    els.forEach((el) => {
      el.style.transition = '';
      el.classList.add('in');
    });
  };

  /* ------------------------------------------------------ project filters */
  const filterBtns = qsa('[data-filter-btn]');
  if (filterBtns.length) {
    const items = qsa('[data-filter-item]');

    filterBtns.forEach((btn) => {
      const v = btn.textContent.trim().toLowerCase();
      btn.dataset.filter = v;
      const n = v === 'all' ? items.length : items.filter((li) => li.dataset.category === v).length;
      btn.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
    });
    count('projects', items.length);
    count('project-categories', filterBtns.length - 1);

    const apply = (value, remember) => {
      const btn = filterBtns.find((b) => b.dataset.filter === value) || filterBtns[0];
      const v = btn.dataset.filter;
      filterBtns.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      const shown = [];
      items.forEach((li) => {
        const match = v === 'all' || li.dataset.category === v;
        li.classList.toggle('hidden', !match);
        if (match) shown.push(li);
      });
      // the filter is part of the URL, so a filtered list can be shared
      if (remember) {
        const url = new URL(location.href);
        if (v === 'all') url.searchParams.delete('c');
        else url.searchParams.set('c', v);
        history.replaceState(null, '', url);
      }
      return shown;
    };

    filterBtns.forEach((btn) => btn.addEventListener('click', () => replay(apply(btn.dataset.filter, true))));
    const initial = new URLSearchParams(location.search).get('c');
    if (initial) apply(initial.toLowerCase(), false);
  }

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

  /* ---------------------------------------------------------- copy buttons */
  const copy = (text, btn) => {
    const done = () => {
      toast('Copied');
      if (!btn) return;
      btn.textContent = 'Copied';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => (btn.textContent = 'Copy'), 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => toast(text));
    else toast(text);
  };
  qsa('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, b)));

  /* -------------------------------------------------------- command palette */
  let closePalette = () => {};
  const cmdk = qs('[data-cmdk]');
  if (cmdk) {
    const input = qs('[data-cmdk-input]', cmdk);
    const list = qs('[data-cmdk-list]', cmdk);
    let lastFocus = null;
    let cursor = 0;
    let visible = [];

    const chrome = window.Chrome || { pages: [], current: '' };
    const COMMANDS = [
      ...chrome.pages.map((p) => ({
        group: 'Pages', label: p.label, hint: p.id === chrome.current ? 'Current' : 'Go', href: p.href,
      })),

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

      { group: 'Actions', label: 'Copy email address', hint: 'Copy', run: () => copy('subroto.2003@gmail.com') },
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
      if (!cmdk.classList.contains('open')) return;
      cmdk.classList.remove('open');
      document.body.classList.remove('is-locked');
      if (lastFocus) lastFocus.focus();
    };
    closePalette = close;

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
  // deep links into JSON-rendered pages: the target moves as content loads,
  // so settle on it again until the visitor scrolls on their own
  let userMoved = false;
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) =>
    addEventListener(t, () => (userMoved = true), { once: true, passive: true })
  );
  const settleHash = () => {
    if (userMoved || location.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ block: 'start' });
  };

  observeReveals();
  document.addEventListener('content:updated', () => {
    observeReveals();
    settleHash();
    onScroll();
  });

  // coming back through the back/forward cache: never restore an open overlay
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    closeDrawer();
    closePalette();
  });

  window.UI = { toast };
})();
