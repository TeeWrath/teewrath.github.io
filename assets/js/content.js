'use strict';

/* content.js — renders experience, freelance, testimonials, community,
   tools & tech (+ the hero ticker) and sessions from the JSON files in ./data/
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
            <li class="card xp-company reveal">
              <div class="xp-head">
                <span class="xp-logo">${esc(c.logo)}</span>
                <div class="xp-head-info">
                  <h4 class="xp-company-name">${esc(c.company)}</h4>
                  <p class="xp-company-meta">${esc(c.meta)}</p>
                </div>
              </div>
              <ol class="xp-roles">
                ${c.roles
                  .map(
                    (role) => `
                  <li class="xp-role${role.current ? ' current' : ''}">
                    <div class="xp-role-head">
                      <h5 class="xp-role-title">${esc(role.title)}</h5>
                      <span class="xp-role-date">${esc(role.date)}</span>
                    </div>
                    <ul class="xp-points">
                      ${role.points.map((p) => `<li>${p}</li>`).join('')}
                    </ul>
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
            <li class="card fl-card reveal">
              <div class="fc-top">
                <h4>${esc(item.title)}</h4>
                <span class="fc-role">${esc(item.role)}</span>
              </div>
              <p>${item.description}</p>
              <a ${item.external ? 'target="_blank" rel="noopener"' : ''} href="${attr(item.linkHref)}">
                ${esc(item.linkText)} <ion-icon name="arrow-forward-outline"></ion-icon>
              </a>
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
            <li class="card tm-card reveal">
              <span class="tm-mark" aria-hidden="true">&ldquo;</span>
              <p class="tm-quote">${esc(t.quote)}</p>
              <div class="tm-author">
                <span class="tm-avatar" aria-hidden="true">${esc(t.avatarLetter)}</span>
                <div>
                  <p class="tm-name">
                    <a href="${attr(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)}</a>
                  </p>
                  <p class="tm-role">${esc(t.role)}</p>
                </div>
              </div>
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
            <li class="tl-item reveal">
              <h4 class="tl-title">${esc(c.title)}</h4>
              <span class="tl-date">${esc(c.date)}</span>
              ${
                c.text || c.linkHref
                  ? `<p class="tl-text">
                      ${c.text || ''}
                      ${c.linkHref ? `<a target="_blank" rel="noopener" href="${attr(c.linkHref)}">${esc(c.linkText)}</a>` : ''}
                     </p>`
                  : ''
              }
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(communityList, 'community.json', err));
  }

  /* --------------------------------------------------------- Tools & Tech */
  const techCloud = document.querySelector('[data-tech-cloud]');
  const tickerTrack = document.querySelector('[data-ticker-track]');
  if (techCloud || tickerTrack) {
    load('./data/tools-tech.json')
      .then((groups) => {
        if (techCloud) {
          techCloud.innerHTML = groups
            .map(
              (g) => `
              <div class="tech-group reveal">
                <p class="tech-label">${esc(g.label)}</p>
                <ul class="tech-list">
                  ${g.items.map((i) => `<li class="tech-chip">${esc(i)}</li>`).join('')}
                </ul>
              </div>`
            )
            .join('');
        }

        if (tickerTrack) {
          // one flat pass of every tool, duplicated for a seamless marquee
          const flat = groups.reduce((all, g) => all.concat(g.items), []);
          const run = flat
            .map((i) => `${esc(i)}<i aria-hidden="true"></i>`)
            .join('');
          tickerTrack.innerHTML = `<span>${run}</span><span>${run}</span>`;
        }

        done();
      })
      .catch((err) => {
        console.error('Failed to load tools-tech.json:', err);
        if (techCloud) techCloud.innerHTML = '<p class="state-line">Couldn\'t load this section.</p>';
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
            <li class="work-item reveal">
              <a class="card work-card brackets" target="_blank" rel="noopener" href="${attr(s.url)}">
                <figure class="work-media">
                  <img src="${attr(s.image)}" alt="${attr(s.title)}" loading="lazy" />
                  <span class="work-eye"><span><ion-icon name="eye-outline"></ion-icon></span></span>
                </figure>
                <div class="work-body">
                  <p class="work-kicker"><i class="pulse-dot" aria-hidden="true"></i> Session</p>
                  <h3 class="work-title">${esc(s.title)}</h3>
                  <p class="work-text">${esc(s.category)}</p>
                  <span class="work-more">Watch <ion-icon name="open-outline"></ion-icon></span>
                </div>
              </a>
            </li>`
          )
          .join('');
        done();
      })
      .catch((err) => fail(sessionsList, 'sessions.json', err));
  }
})();
