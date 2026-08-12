'use strict';

/* ==========================================================================
   app.js — interface engine
   boot · theme · command bar + scroll spy · drawer · particle field
   cursor spotlight · scroll reveals · text scramble · card tilt/spotlight
   project filters · contact form · command palette (⌘K) · timeline beam
   ========================================================================== */

(function () {
  /* ---------------------------------------------------------------- utils */
  const qs = (sel, scope) => (scope || document).querySelector(sel);
  const qsa = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------------- toast */
  let toastEl;
  const toast = (msg) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('on'));
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('on'), 1900);
  };

  /* ---------------------------------------------------------------- boot */
  const boot = qs('[data-boot]');
  const net = qs('[data-net]');
  const startedAt = Date.now();

  let booted = false;
  const finishBoot = () => {
    if (booted) return;
    booted = true;
    // hold the curtain just long enough to read, never long enough to annoy
    const wait = Math.max(0, (reduceMotion ? 100 : 950) - (Date.now() - startedAt));
    setTimeout(() => {
      if (boot) boot.classList.add('done');
      if (net) net.classList.add('on');
      // kick off entrance typing once the curtain lifts
      typeHeroRole();
    }, wait);
  };

  // DOM-ready, not load: third-party embeds must not hold the page hostage
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finishBoot);
  else finishBoot();
  setTimeout(finishBoot, 2200); // hard fallback

  /* ---------------------------------------------------------------- theme */
  const themeBtn = qs('[data-theme-toggle]');
  const setTheme = (next) => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    const meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f1f4f6' : '#080a0c');
  };
  if (themeBtn) {
    themeBtn.addEventListener('click', () =>
      setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light')
    );
  }

  /* ---------------------------------------------------------------- year */
  const year = qs('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* -------------------------------------------------- hero role typing */
  let typed = false;
  function typeHeroRole() {
    const el = qs('[data-typed]');
    if (!el || typed) return;
    typed = true;
    const text = el.dataset.text || el.textContent;
    if (reduceMotion) { el.textContent = text; return; }
    el.textContent = '';
    let i = 0;
    (function step() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 52);
    })();
  }

  /* ------------------------------------------------- command bar + spy */
  const topbar = qs('[data-topbar]');
  const navLinks = qsa('[data-nav-link]');
  const navPill = qs('[data-nav-pill]');
  const progress = qs('[data-progress]');
  const sections = qsa('[data-section]');
  const beams = qsa('[data-beam]');

  const movePill = (link) => {
    if (!navPill) return;
    if (!link) { navPill.style.opacity = '0'; return; }
    navPill.style.opacity = '1';
    navPill.style.width = link.offsetWidth + 'px';
    navPill.style.transform = `translateX(${link.offsetLeft}px)`;
  };

  let activeLink = null;
  const setActive = (id) => {
    const link = id ? navLinks.find((l) => l.getAttribute('href') === '#' + id) : null;
    if (link === activeLink) return;
    navLinks.forEach((l) => l.classList.toggle('active', l === link));
    activeLink = link;
    movePill(link);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const doc = document.documentElement;

      if (topbar) topbar.classList.toggle('stuck', y > 24);

      if (progress) {
        const max = doc.scrollHeight - doc.clientHeight;
        progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
      }

      // scroll spy — last section whose top has passed the bar
      const line = (topbar ? topbar.offsetHeight : 64) + 130;
      let current = null;
      sections.forEach((s) => {
        if (s.getBoundingClientRect().top <= line) current = s.id;
      });
      setActive(current);

      // timeline beams
      beams.forEach((el) => {
        const r = el.getBoundingClientRect();
        const p = clamp((innerHeight * 0.78 - r.top) / Math.max(r.height, 1), 0, 1);
        el.style.setProperty('--beam', (p * 100).toFixed(2));
      });

      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { movePill(activeLink); onScroll(); });
  onScroll();

  /* ---------------------------------------------------------------- drawer */
  const drawerBtn = qs('[data-drawer-toggle]');
  const closeDrawer = () => {
    document.body.classList.remove('drawer-open', 'is-locked');
    if (drawerBtn) drawerBtn.setAttribute('aria-expanded', 'false');
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

  /* --------------------------------------------------------- cursor glow */
  if (finePointer && !reduceMotion) {
    const glow = qs('.cursor-glow');
    if (glow) {
      let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, shown = false;
      addEventListener('mousemove', (e) => {
        x = e.clientX; y = e.clientY;
        if (!shown) { glow.style.opacity = '1'; shown = true; }
      }, { passive: true });
      document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; shown = false; });
      (function loop() {
        cx += (x - cx) * 0.13;
        cy += (y - cy) * 0.13;
        glow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        requestAnimationFrame(loop);
      })();
    }
  }

  /* ------------------------------------------------------ particle field */
  // isolated: a canvas failure must never take the rest of the interface down
  if (net && !reduceMotion) try {
    const ctx = net.getContext('2d');
    const styles = getComputedStyle(root);
    let w = 0, h = 0, dpr = 1, nodes = [], raf = 0;
    const pointer = { x: -9999, y: -9999 };
    const LINK = 132;

    const readColor = (name, fallback) =>
      (styles.getPropertyValue(name) || fallback).trim() || fallback;

    let lineColor = readColor('--net-line', 'rgba(90,220,235,.5)');
    let dotColor = readColor('--net-dot', 'rgba(150,235,255,.8)');

    const build = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = innerWidth;
      h = innerHeight;
      net.width = Math.floor(w * dpr);
      net.height = Math.floor(h * dpr);
      net.style.width = w + 'px';
      net.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = clamp(Math.round((w * h) / 26000), 22, innerWidth < 700 ? 34 : 78);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: Math.random() * 1.3 + 0.7,
      }));
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        // gentle drift away from the cursor
        const dx = n.x - pointer.x, dy = n.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000 && d2 > 0.01) {
          const f = (1 - d2 / 14000) * 0.55;
          const d = Math.sqrt(d2);
          n.x += (dx / d) * f;
          n.y += (dy / d) * f;
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.globalAlpha = (1 - d / LINK) * 0.3;
            ctx.strokeStyle = lineColor;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // link to the cursor
        const mx = a.x - pointer.x, my = a.y - pointer.y;
        const md = Math.hypot(mx, my);
        if (md < 190) {
          ctx.globalAlpha = (1 - md / 190) * 0.45;
          ctx.strokeStyle = lineColor;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.75;
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    build();
    start();

    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(build, 180);
    });
    if (finePointer) {
      addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
      document.addEventListener('mouseleave', () => { pointer.x = pointer.y = -9999; });
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    // repaint palette when the theme flips
    if (themeBtn) themeBtn.addEventListener('click', () => {
      setTimeout(() => {
        lineColor = readColor('--net-line', lineColor);
        dotColor = readColor('--net-dot', dotColor);
      }, 60);
    });
  } catch (err) {
    console.warn('Particle field disabled:', err);
    net.remove();
  }

  /* --------------------------------------------------------- scramble text */
  const GLYPHS = '█▓▒░<>/\\|{}[]#*+=$@%&01';
  const scramble = (el) => {
    if (reduceMotion || el.dataset.scrambled) return;
    el.dataset.scrambled = '1';
    const text = el.textContent;
    const total = 16 + text.length * 2;
    let f = 0;
    (function step() {
      const done = Math.floor((f / total) * text.length * 1.35);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ') { out += ' '; continue; }
        out += i < done ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (f++ < total) requestAnimationFrame(step);
      else el.textContent = text;
    })();
  };

  /* ------------------------------------------------------- scroll reveals */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          io.unobserve(entry.target);
          const title = entry.target.matches('[data-scramble]')
            ? entry.target
            : qs('[data-scramble]', entry.target);
          if (title) scramble(title);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' })
    : null;

  const observeReveals = () => {
    qsa('.reveal:not([data-seen])').forEach((el) => {
      el.dataset.seen = '1';
      if (!io) { el.classList.add('in'); return; }
      // stagger by position among reveal siblings
      const sibs = Array.from(el.parentElement ? el.parentElement.children : []).filter((n) =>
        n.classList.contains('reveal')
      );
      const idx = Math.max(0, sibs.indexOf(el));
      el.style.setProperty('--d', Math.min(idx, 7) * 70 + 'ms');
      io.observe(el);
    });
  };

  /* ------------------------------------------- card spotlight + soft tilt */
  const TILT = 3.6;
  const bindCards = () => {
    qsa('.card:not([data-bound])').forEach((card) => {
      card.dataset.bound = '1';
      const tiltable = finePointer && !reduceMotion && card.matches('.work-card, .svc-card, .fl-card, .tm-card');

      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (px * 100).toFixed(2) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(2) + '%');
        if (tiltable) {
          card.style.transition = 'transform .14s linear, border-color .4s, box-shadow .5s';
          card.style.transform =
            `perspective(1000px) rotateX(${((0.5 - py) * TILT).toFixed(2)}deg) ` +
            `rotateY(${((px - 0.5) * TILT).toFixed(2)}deg) translateY(-5px)`;
        }
      }, { passive: true });

      card.addEventListener('mouseleave', () => {
        card.style.transition = '';
        card.style.transform = '';
      });
    });
  };

  /* ------------------------------------------------------ project filters */
  const filterItems = () => qsa('[data-filter-item]');
  const selectValue = qs('[data-select-value]');
  const filterBtns = qsa('[data-filter-btn]');

  const applyFilter = (value) => {
    const v = String(value).toLowerCase();
    const shown = [];
    filterItems().forEach((li) => {
      const match = v === 'all' || li.dataset.category === v;
      li.classList.toggle('hidden', !match);
      if (match) shown.push(li);
    });
    if (reduceMotion) return;
    shown.forEach((li, i) => {
      li.classList.add('filtering');
      li.style.transitionDelay = Math.min(i, 8) * 28 + 'ms';
      requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('filtering')));
      setTimeout(() => (li.style.transitionDelay = ''), 700);
    });
  };

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (selectValue) selectValue.textContent = btn.textContent.trim();
      applyFilter(btn.textContent.trim());
    });
  });

  const select = qs('[data-select]');
  if (select) {
    select.addEventListener('click', (e) => {
      e.stopPropagation();
      select.classList.toggle('open');
    });
    document.addEventListener('click', () => select.classList.remove('open'));
  }
  qsa('[data-select-item]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      if (selectValue) selectValue.textContent = label;
      if (select) select.classList.remove('open');
      filterBtns.forEach((b) => b.classList.toggle('active', b.textContent.trim() === label));
      applyFilter(label);
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
      { group: 'Sections', label: 'About', icon: 'person-outline', hint: 'Jump', href: '#about' },
      { group: 'Sections', label: 'Experience', icon: 'briefcase-outline', hint: 'Jump', href: '#experience' },
      { group: 'Sections', label: 'Projects', icon: 'cube-outline', hint: 'Jump', href: '#projects' },
      { group: 'Sections', label: 'Sessions', icon: 'mic-outline', hint: 'Jump', href: '#sessions' },
      { group: 'Sections', label: 'Blog', icon: 'document-text-outline', hint: 'Jump', href: '#blog' },
      { group: 'Sections', label: 'Contact', icon: 'send-outline', hint: 'Jump', href: '#contact' },

      { group: 'Links', label: 'View Résumé', icon: 'newspaper-outline', hint: 'Open',
        href: 'https://drive.google.com/drive/folders/1ex4i0-DQcms5r-k4Vz_VuVopnX_t4C9b?usp=sharing', ext: true },
      { group: 'Links', label: 'Email — subroto.2003@gmail.com', icon: 'mail-outline', hint: 'Mail',
        href: 'mailto:subroto.2003@gmail.com' },
      { group: 'Links', label: 'GitHub', icon: 'logo-github', hint: 'Open', href: 'https://github.com/TeeWrath', ext: true },
      { group: 'Links', label: 'LinkedIn', icon: 'logo-linkedin', hint: 'Open',
        href: 'https://www.linkedin.com/in/subroto-banerjee-70983b214/', ext: true },
      { group: 'Links', label: 'Twitter', icon: 'logo-twitter', hint: 'Open', href: 'https://twitter.com/Subroto0108', ext: true },
      { group: 'Links', label: 'Instagram', icon: 'logo-instagram', hint: 'Open',
        href: 'https://instagram.com/subroto._banerjee', ext: true },
      { group: 'Links', label: 'Reddit', icon: 'logo-reddit', hint: 'Open', href: 'https://reddit.com/u/TeeWrath', ext: true },
      { group: 'Links', label: 'bio.link', icon: 'link-outline', hint: 'Open', href: 'https://bio.link/teewrath', ext: true },
      { group: 'Links', label: 'Mastodon', icon: 'logo-mastodon', hint: 'Open', href: 'https://mastodon.social/@TeeWrath', ext: true },

      { group: 'Actions', label: 'Copy email address', icon: 'copy-outline', hint: 'Copy',
        run: () => {
          const mail = 'subroto.2003@gmail.com';
          if (navigator.clipboard) navigator.clipboard.writeText(mail).then(() => toast('Email copied'));
          else toast(mail);
        } },
      { group: 'Actions', label: 'Toggle theme', icon: 'contrast-outline', hint: 'Switch',
        run: () => setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light') },
      { group: 'Actions', label: 'Back to top', icon: 'arrow-up-outline', hint: 'Scroll',
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
          `<ion-icon name="${c.icon}"></ion-icon><span>${c.label}</span>` +
          `<span class="hint">${c.hint}</span></button>`;
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
      cmdk.classList.add('open');
      document.body.classList.add('is-locked');
      input.value = '';
      render('');
      setTimeout(() => input.focus(), 60);
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
      if (!isOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % visible.length; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + visible.length) % visible.length; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(visible[cursor]); }
    });
  }

  /* ------------------------------------------------------------- lifecycle */
  observeReveals();
  bindCards();
  document.addEventListener('content:updated', () => {
    observeReveals();
    bindCards();
    onScroll();
  });

  // expose a couple of helpers for the JSON renderers
  window.UI = { observeReveals, bindCards, toast };
})();
