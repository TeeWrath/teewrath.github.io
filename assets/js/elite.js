'use strict';

/* elite.js — theme, motion + atmosphere (additive, non-breaking) */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(pointer: fine)').matches;
  const root = document.documentElement;

  /* ---------- theme toggle ---------- */
  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'light' ? '#f2f2f2' : '#0a0a0a');
    });
  }

  /* ---------- page navigation helpers (drive existing nav) ---------- */
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
  const goToPage = (name) => {
    const link = navLinks.find((l) => l.innerHTML.trim().toLowerCase() === name.toLowerCase());
    if (link) { link.click(); window.scrollTo(0, 0); }
  };

  // CTAs anywhere that want to switch pages: data-nav-to="contact"
  document.querySelectorAll('[data-nav-to]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      goToPage(el.getAttribute('data-nav-to'));
    });
  });

  // open a page from URL hash (e.g. coming back from post.html#blog)
  if (location.hash) {
    const target = location.hash.replace('#', '');
    if (navLinks.some((l) => l.innerHTML.trim().toLowerCase() === target)) {
      requestAnimationFrame(() => goToPage(target));
    }
  }

  /* ---------- cursor glow ---------- */
  if (finePointer && !reduceMotion) {
    const glow = document.querySelector('.cursor-glow');
    if (glow) {
      let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, shown = false;
      addEventListener('mousemove', (e) => {
        x = e.clientX; y = e.clientY;
        if (!shown) { glow.style.opacity = '1'; shown = true; }
      });
      addEventListener('mouseleave', () => { glow.style.opacity = '0'; shown = false; });
      (function loop() {
        cx += (x - cx) * 0.12; cy += (y - cy) * 0.12;
        glow.style.transform = `translate(${cx}px, ${cy}px)`;
        requestAnimationFrame(loop);
      })();
    }
  }

  /* ---------- scroll reveal ---------- */
  const REVEAL_SEL =
    '.service-item, .xp-company, .timeline-item, .project-item, .blog-post-item, ' +
    '.tech-group, .freelance-card, .freelance-cta, .tm-card, ' +
    '.about-text > p, .service-title, .timeline .title-wrapper, .contact-form > *';

  if (reduceMotion) {
    const markAll = () => document.querySelectorAll(REVEAL_SEL).forEach((el) => el.classList.add('reveal', 'in'));
    markAll();
    document.addEventListener('content:updated', markAll);
    applyTilt();
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  const stagger = (scope) => {
    const items = scope.querySelectorAll(REVEAL_SEL);
    let i = 0;
    items.forEach((el) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', Math.min(i, 6) * 65 + 'ms');
      i++;
      io.observe(el);
    });
  };

  document.querySelectorAll('article').forEach(stagger);

  // re-stagger the active page when switching tabs
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      requestAnimationFrame(() => {
        const active = document.querySelector('article.active');
        if (!active) return;
        active.querySelectorAll('.reveal').forEach((el, idx) => {
          el.classList.remove('in');
          el.style.setProperty('--reveal-delay', Math.min(idx, 6) * 65 + 'ms');
          requestAnimationFrame(() => io.observe(el));
        });
      });
    });
  });

  // blog cards are injected async — observe them when ready
  document.addEventListener('content:updated', () => {
    const blog = document.querySelector('article.blog');
    if (blog) stagger(blog);
    applyTilt();
  });

  /* ---------- subtle 3D tilt ---------- */
  function applyTilt() {
    if (!finePointer || reduceMotion) return;
    const MAX = 5;
    document.querySelectorAll('.service-item, .project-item > a, .blog-post-item > a, .freelance-card')
      .forEach((card) => {
        if (card.dataset.tilt) return;
        card.dataset.tilt = '1';
        card.addEventListener('mousemove', (e) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform =
            `perspective(900px) rotateX(${(-py * MAX).toFixed(2)}deg) rotateY(${(px * MAX).toFixed(2)}deg) translateY(-5px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      });
  }
  applyTilt();
})();
