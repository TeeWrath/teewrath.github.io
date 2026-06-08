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

  const escapeAttr = (s) => String(s).replace(/"/g, '&quot;');

  const card = (p) => {
    const isSelf = p.type === 'self';
    const href = isSelf ? `./post.html?id=${encodeURIComponent(p.id)}` : p.url;
    const target = isSelf ? '' : ' target="_blank" rel="noopener"';
    const tag = isSelf
      ? '<span class="blog-tag-self">Mine</span>'
      : '<span class="blog-tag-ext">External &#8599;</span>';
    const cover = p.cover
      ? `<figure class="blog-banner-box"><img src="${escapeAttr(p.cover)}" alt="${escapeAttr(p.title)}" loading="lazy" /></figure>`
      : `<div class="blog-cover-fallback"><span>${escapeAttr((p.category || 'Writing').toUpperCase())}</span></div>`;
    const readmore = isSelf
      ? '<span class="blog-readmore">Read article &#8594;</span>'
      : '<span class="blog-readmore">Read on the web &#8599;</span>';

    return `
      <li class="blog-post-item reveal" data-type="${p.type}">
        <a href="${escapeAttr(href)}"${target}>
          ${cover}
          <div class="blog-content">
            <div class="blog-meta">
              <p class="blog-category">${escapeAttr(p.category || '')}</p>
              <span class="dot"></span>
              <time datetime="${escapeAttr(p.date)}">${fmtDate(p.date)}</time>
              ${tag}
            </div>
            <h3 class="h3 blog-item-title">${escapeAttr(p.title)}</h3>
            <p class="blog-text">${escapeAttr(p.excerpt || '')}</p>
            ${readmore}
          </div>
        </a>
      </li>`;
  };

  let posts = [];

  const render = (filter) => {
    const shown = filter === 'all' ? posts : posts.filter((p) => p.type === filter);
    list.innerHTML = shown.length
      ? shown.map(card).join('')
      : '<li class="blog-empty">No posts here yet.</li>';
    // let the reveal observer (elite.js) pick up the new nodes
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
        '<li class="blog-empty">Couldn\'t load posts. If you opened this file directly, run a local server (e.g. <code>python3 -m http.server</code>).</li>';
    });

  // filter tabs
  const tabs = document.querySelectorAll('[data-blog-filter]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.blogFilter);
    });
  });
})();
