'use strict';

/* content.js — renders experience, freelance, testimonials, community,
   tools & tech and sessions from the JSON files in ./data/
   Single source of truth for these sections: edit the JSON, not the HTML. */

(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const attr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

  const done = () => document.dispatchEvent(new CustomEvent('content:updated'));

  const load = (path) =>
    fetch(path, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(path + ' → ' + r.status);
      return r.json();
    });

  const fail = (node, path, err) => {
    console.error('Failed to load ' + path + ':', err);
    if (node) node.innerHTML = '<li class="state-line">Couldn\'t load this section.</li>';
  };

  /* ---------------------------------------------------------- Experience */
  const xpList = document.querySelector('[data-xp-list]');
  if (xpList) {
    load('./data/experience.json')
      .then((companies) => {
        xpList.innerHTML = companies
          .map(
            (c) => `
            <li>
              <div class="xp-head offset">
                <h4 class="xp-company-name">${esc(c.company)}</h4>
                <p class="xp-company-meta">${esc(c.meta)}</p>
              </div>
              <ol class="xp-roles">
                ${c.roles
                  .map(
                    (role) => `
                  <li class="entry xp-role${role.current ? ' current' : ''}">
                    <p class="entry-aside">${esc(role.date)}</p>
                    <div>
                      <h5 class="entry-title">${esc(role.title)}</h5>
                      <ul class="bullets">
                        ${role.points.map((p) => `<li>${p}</li>`).join('')}
                      </ul>
                    </div>
                  </li>`
                  )
                  .join('')}
              </ol>
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(xpList, 'experience.json', err));
  }

  /* ----------------------------------------------------------- Freelance */
  const freelanceNote = document.querySelector('[data-freelance-note]');
  const freelanceList = document.querySelector('[data-freelance-list]');
  const freelanceCta = document.querySelector('[data-freelance-cta]');
  if (freelanceList) {
    load('./data/freelance.json')
      .then((data) => {
        if (freelanceNote) freelanceNote.textContent = data.note;
        freelanceList.innerHTML = data.items
          .map(
            (item) => `
            <li class="entry">
              <p class="entry-aside">${esc(item.role)}</p>
              <div>
                <h4 class="entry-title">${esc(item.title)}</h4>
                <p class="entry-text">${item.description}</p>
                <a class="link entry-link" ${item.external ? 'target="_blank" rel="noopener"' : ''} href="${attr(item.linkHref)}">${esc(item.linkText)} ${item.external ? '↗' : '→'}</a>
              </div>
            </li>`
          )
          .join('');
        if (freelanceCta) freelanceCta.querySelector('span').textContent = data.cta;
        done();
      })
      .catch((err) => fail(freelanceList, 'freelance.json', err));
  }

  /* -------------------------------------------------------- Testimonials */
  const tmList = document.querySelector('[data-tm-list]');
  if (tmList) {
    load('./data/testimonials.json')
      .then((items) => {
        tmList.innerHTML = items
          .map(
            (t) => `
            <li class="quote offset">
              <blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote>
              <p class="quote-by">
                <a href="${attr(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)}</a>, ${esc(t.role)}
              </p>
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(tmList, 'testimonials.json', err));
  }

  /* ---------------------------------------------------- Community efforts */
  const communityList = document.querySelector('[data-community-list]');
  if (communityList) {
    load('./data/community.json')
      .then((items) => {
        communityList.innerHTML = items
          .map(
            (c) => `
            <li class="entry">
              <p class="entry-aside">${esc(c.date)}</p>
              <div>
                <h4 class="entry-title">${esc(c.title)}</h4>
                ${
                  c.text || c.linkHref
                    ? `<p class="entry-text">
                        ${c.text || ''}
                        ${c.linkHref ? `<a class="link" target="_blank" rel="noopener" href="${attr(c.linkHref)}">${esc(c.linkText)} ↗</a>` : ''}
                       </p>`
                    : ''
                }
              </div>
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(communityList, 'community.json', err));
  }

  /* --------------------------------------------------------- Tools & Tech */
  const techCloud = document.querySelector('[data-tech-cloud]');
  if (techCloud) {
    load('./data/tools-tech.json')
      .then((groups) => {
        techCloud.innerHTML = groups
          .map(
            (g) => `
            <div class="entry">
              <p class="entry-aside">${esc(String(g.label).replace(/:\s*$/, ''))}</p>
              <ul class="inline-list entry-text" style="margin-top: 0">
                ${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}
              </ul>
            </div>`
          )
          .join('');
        done();
      })
      .catch((err) => {
        console.error('Failed to load tools-tech.json:', err);
        techCloud.innerHTML = '<p class="state-line">Couldn\'t load this section.</p>';
      });
  }

  /* ------------------------------------------------------ Sessions / Talks */
  const sessionsList = document.querySelector('[data-sessions-list]');
  if (sessionsList) {
    load('./data/sessions.json')
      .then((items) => {
        sessionsList.innerHTML = items
          .map(
            (s) => `
            <li>
              <a class="row row--media" target="_blank" rel="noopener" href="${attr(s.url)}">
                <figure class="row-thumb">
                  <img src="${attr(s.image)}" alt="" loading="lazy" />
                </figure>
                <span class="row-main">
                  <h3 class="row-title">${esc(s.title)}</h3>
                  <p class="row-text">${esc(s.category)}</p>
                </span>
                <span class="row-arrow ext" aria-hidden="true">↗</span>
              </a>
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(sessionsList, 'sessions.json', err));
  }
})();
