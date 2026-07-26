'use strict';

/* content.js — renders experience, freelance, testimonials, community,
   tools & tech, and sessions from the JSON files in ./data/
   Single source of truth for these sections: edit the JSON, not the HTML. */

(function () {
  const escapeAttr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

  const done = () => document.dispatchEvent(new CustomEvent('content:updated'));

  // ---------- Experience ----------
  const xpList = document.querySelector('[data-xp-list]');
  if (xpList) {
    fetch('./data/experience.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((companies) => {
        xpList.innerHTML = companies
          .map((c) => `
            <li class="xp-company">
              <div class="xp-head">
                <span class="xp-logo">${escapeAttr(c.logo)}</span>
                <div class="xp-head-info">
                  <h4 class="xp-company-name">${escapeAttr(c.company)}</h4>
                  <p class="xp-company-meta">${escapeAttr(c.meta)}</p>
                </div>
              </div>
              <ol class="xp-roles">
                ${c.roles.map((role) => `
                  <li class="xp-role${role.current ? ' current' : ''}">
                    <div class="xp-role-head">
                      <h5 class="xp-role-title">${escapeAttr(role.title)}</h5>
                      <span class="xp-role-date">${escapeAttr(role.date)}</span>
                    </div>
                    <ul class="xp-points">
                      ${role.points.map((p) => `<li>${p}</li>`).join('')}
                    </ul>
                  </li>`).join('')}
              </ol>
            </li>`)
          .join('');
        done();
      })
      .catch((err) => console.error('Failed to load experience.json:', err));
  }

  // ---------- Freelance ----------
  const freelanceNote = document.querySelector('[data-freelance-note]');
  const freelanceList = document.querySelector('[data-freelance-list]');
  const freelanceCta = document.querySelector('[data-freelance-cta]');
  if (freelanceList) {
    fetch('./data/freelance.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((data) => {
        if (freelanceNote) freelanceNote.textContent = data.note;
        freelanceList.innerHTML = data.items
          .map((item) => `
            <li class="freelance-card">
              <div class="fc-top">
                <h4>${escapeAttr(item.title)}</h4>
                <span class="fc-role">${escapeAttr(item.role)}</span>
              </div>
              <p>${item.description}</p>
              <a ${item.external ? 'target="_blank"' : ''} href="${escapeAttr(item.linkHref)}"${item.navTo ? ` data-nav-to="${escapeAttr(item.navTo)}"` : ''}>
                ${escapeAttr(item.linkText)} <ion-icon name="arrow-forward-outline"></ion-icon>
              </a>
            </li>`)
          .join('');
        if (freelanceCta) freelanceCta.querySelector('span').textContent = data.cta;
        done();
      })
      .catch((err) => console.error('Failed to load freelance.json:', err));
  }

  // ---------- Testimonials ----------
  const tmList = document.querySelector('[data-tm-list]');
  if (tmList) {
    fetch('./data/testimonials.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((items) => {
        tmList.innerHTML = items
          .map((t) => `
            <li class="tm-card">
              <span class="tm-mark">&ldquo;</span>
              <p class="tm-quote">${escapeAttr(t.quote)}</p>
              <div class="tm-author">
                <span class="tm-avatar">${escapeAttr(t.avatarLetter)}</span>
                <div>
                  <p class="tm-name">
                    <a href="${escapeAttr(t.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: inherit;">${escapeAttr(t.name)}</a>
                  </p>
                  <p class="tm-role">${escapeAttr(t.role)}</p>
                </div>
              </div>
            </li>`)
          .join('');
        done();
      })
      .catch((err) => console.error('Failed to load testimonials.json:', err));
  }

  // ---------- Community efforts ----------
  const communityList = document.querySelector('[data-community-list]');
  if (communityList) {
    fetch('./data/community.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((items) => {
        communityList.innerHTML = items
          .map((c) => `
            <li class="timeline-item">
              <h4 class="h4 timeline-item-title">${escapeAttr(c.title)}</h4>
              <span>${escapeAttr(c.date)}</span>
              <p class="timeline-text">
                ${c.text || ''}
                ${c.linkHref ? `<a target="_blank" href="${escapeAttr(c.linkHref)}">${escapeAttr(c.linkText)}</a>` : ''}
              </p>
            </li>`)
          .join('');
        done();
      })
      .catch((err) => console.error('Failed to load community.json:', err));
  }

  // ---------- Tools & Tech ----------
  const techCloud = document.querySelector('[data-tech-cloud]');
  if (techCloud) {
    fetch('./data/tools-tech.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((groups) => {
        techCloud.innerHTML = groups
          .map((g) => `
            <div class="tech-group">
              <p class="tech-label">${escapeAttr(g.label)}</p>
              <ul class="tech-list">
                ${g.items.map((i) => `<li class="tech-chip">${escapeAttr(i)}</li>`).join('')}
              </ul>
            </div>`)
          .join('');
        done();
      })
      .catch((err) => console.error('Failed to load tools-tech.json:', err));
  }

  // ---------- Sessions / Talks ----------
  const sessionsList = document.querySelector('[data-sessions-list]');
  if (sessionsList) {
    fetch('./data/sessions.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((items) => {
        sessionsList.innerHTML = items
          .map((s) => `
            <li class="project-item active">
              <a target="_blank" href="${escapeAttr(s.url)}">
                <figure class="project-img">
                  <div class="project-item-icon-box">
                    <ion-icon name="eye-outline"></ion-icon>
                  </div>
                  <img src="${escapeAttr(s.image)}" alt="${escapeAttr(s.title)}" loading="lazy" />
                </figure>
                <h3 class="project-title">${escapeAttr(s.title)}</h3>
                <p class="project-category">${escapeAttr(s.category)}</p>
              </a>
            </li>`)
          .join('');
        done();
      })
      .catch((err) => console.error('Failed to load sessions.json:', err));
  }
})();
