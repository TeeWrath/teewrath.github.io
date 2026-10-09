'use strict';

/* studio-posts.js — reads posts written in /studio from Supabase.
   Only rows the RLS policy exposes (published, publish time reached) are returned.
   The anon key is public by design. */

window.StudioPosts = (function () {
  const URL_ = 'https://zxjyeifoutndgnvxkhwe.supabase.co';
  const KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4anllaWZvdXRuZGdudnhraHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjY5MjAsImV4cCI6MjEwNzE0MjkyMH0.KM7ErVyN483UKFuBfiYWmKm3G71tboxY_4TaCUDX2G0';

  const q = (query) =>
    fetch(`${URL_}/rest/v1/posts?${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    }).then((r) => {
      if (!r.ok) throw new Error('supabase ' + r.status);
      return r.json();
    });

  // Same shape as an entry in blog/posts.json, so blog.js renders both alike.
  const toEntry = (p) => ({
    id: p.slug,
    type: 'self',
    source: 'studio',
    title: p.title,
    category: p.category,
    date: (p.published_at || p.created_at).slice(0, 10),
    cover: p.cover_url || '',
    excerpt: p.excerpt,
    reading: p.reading_min + ' min read',
  });

  const SAFE_FRAME = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\//;

  // Content comes from the author only, but never inject it raw.
  const sanitize = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, object, embed, link, meta, form').forEach((n) => n.remove());
    doc.querySelectorAll('iframe').forEach((n) => {
      if (!SAFE_FRAME.test(n.getAttribute('src') || '')) n.remove();
    });
    doc.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((a) => {
        const n = a.name.toLowerCase();
        if (n.startsWith('on') || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    doc.querySelectorAll('a[href^="http"]').forEach((a) => a.setAttribute('rel', 'noopener'));
    // image title → caption
    doc.querySelectorAll('img[title]').forEach((img) => {
      const t = img.getAttribute('title');
      if (!t) return;
      const fig = doc.createElement('figure');
      const cap = doc.createElement('figcaption');
      cap.textContent = t;
      img.removeAttribute('title');
      img.setAttribute('loading', 'lazy');
      img.replaceWith(fig);
      fig.append(img, cap);
    });
    return doc.body.innerHTML;
  };

  return {
    list: () =>
      q('select=slug,title,category,excerpt,cover_url,reading_min,published_at,created_at&order=published_at.desc')
        .then((rows) => rows.map(toEntry))
        .catch((e) => {
          console.warn('Studio posts unavailable:', e);
          return [];
        }),

    get: (slug) =>
      q('select=*&slug=eq.' + encodeURIComponent(slug) + '&limit=1').then((rows) => {
        if (!rows.length) return null;
        const p = rows[0];
        return { post: Object.assign(toEntry(p), { seo_title: p.seo_title, seo_desc: p.seo_desc }), html: sanitize(p.content_html) };
      }),
  };
})();
