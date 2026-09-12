'use strict';

/* blog.js — renders the blog index from blog/posts.json (no backend) */

(function () {
  const list = document.querySelector('[data-blog-list]');
  if (!list) return;

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const row = (p) => {
    const isSelf = p.type === 'self';
    const href = isSelf ? `./post.html?id=${encodeURIComponent(p.id)}` : p.url;
    const target = isSelf ? '' : ' target="_blank" rel="noopener"';
    const tag = isSelf ? '<span class="tag">Mine</span>' : '<span class="tag">External</span>';
    const cover = p.cover
      ? `<img src="${esc(p.cover)}" alt="" loading="lazy" />`
      : `<span class="row-thumb-fallback">${esc(p.category || 'Writing')}</span>`;
    const label = isSelf ? 'Read article' : 'Read on the web';

    return `
      <li data-type="${esc(p.type)}">
        <a class="row row--media" href="${esc(href)}"${target} title="${label}">
          <figure class="row-thumb">${cover}</figure>
          <span class="row-main">
            <p class="row-meta">
              <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time><span class="sep">·</span>${esc(p.category || '')}<span class="sep">·</span>${tag}
            </p>
            <h3 class="row-title">${esc(p.title)}</h3>
            <p class="row-text">${esc(p.excerpt || '')}</p>
          </span>
          <span class="row-arrow${isSelf ? '' : ' ext'}" aria-hidden="true">${isSelf ? '→' : '↗'}</span>
        </a>
      </li>`;
  };

  let posts = [];

  const render = (filter) => {
    const shown = filter === 'all' ? posts : posts.filter((p) => p.type === filter);
    list.innerHTML = shown.length
      ? shown.map(row).join('')
      : '<li class="state-line">No posts here yet.</li>';
    document.dispatchEvent(new CustomEvent('content:updated'));
  };

  fetch('./blog/posts.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error('posts.json ' + r.status);
      return r.json();
    })
    .then((data) => {
      posts = data.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      render('all');
    })
    .catch((err) => {
      console.error('Blog load failed:', err);
      list.innerHTML =
        '<li class="state-line">Couldn\'t load posts. If you opened this file directly, run a local server (e.g. <code>python3 -m http.server</code>).</li>';
    });

  // filter tabs
  const tabs = Array.from(document.querySelectorAll('[data-blog-filter]'));
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      render(btn.dataset.blogFilter);
    });
  });
})();
