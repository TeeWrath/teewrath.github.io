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

  const card = (p) => {
    const isSelf = p.type === 'self';
    const href = isSelf ? `./post.html?id=${encodeURIComponent(p.id)}` : p.url;
    const target = isSelf ? '' : ' target="_blank" rel="noopener"';
    const tag = isSelf
      ? '<span class="blog-tag self">Mine</span>'
      : '<span class="blog-tag ext">External &#8599;</span>';
    const cover = p.cover
      ? `<img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" />`
      : `<div class="blog-fallback"><span>${esc((p.category || 'Writing').toUpperCase())}</span></div>`;
    const readmore = isSelf
      ? 'Read article <ion-icon name="arrow-forward-outline"></ion-icon>'
      : 'Read on the web <ion-icon name="open-outline"></ion-icon>';

    return `
      <li class="reveal" data-type="${esc(p.type)}">
        <a class="card blog-card brackets" href="${esc(href)}"${target}>
          <figure class="blog-cover">${cover}</figure>
          <div class="blog-body">
            <div class="blog-meta">
              <span class="blog-cat">${esc(p.category || '')}</span>
              <span class="dot" aria-hidden="true"></span>
              <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
              ${tag}
            </div>
            <h3 class="blog-title">${esc(p.title)}</h3>
            <p class="blog-excerpt">${esc(p.excerpt || '')}</p>
            <span class="blog-read">${readmore}</span>
          </div>
        </a>
      </li>`;
  };

  let posts = [];

  const render = (filter) => {
    const shown = filter === 'all' ? posts : posts.filter((p) => p.type === filter);
    list.innerHTML = shown.length
      ? shown.map(card).join('')
      : '<li class="state-line">No posts here yet.</li>';
    // let app.js pick up the new nodes (reveals + card interactions)
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
      tabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.blogFilter);
    });
  });
})();
