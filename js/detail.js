/* ── detail.js — slide-over project detail panel ─────────────────────────── */
'use strict';

function openDetail(idx) {
  const p = NX.allProjects[idx];
  if (!p) return;

  el('so-breadcrumb').textContent = teamLabel(p.team) || 'Project';
  const gh        = p._github;
  const teamCol   = teamColor(p.team);
  const statusCols = { active: 'var(--active)', planning: 'var(--planning)', paused: 'var(--paused)' };
  const statusCol  = statusCols[p.status] || 'var(--t3)';

  /* ── Update log ────────────────────────────────────────────────────────── */
  const updates = (p.update_log || '').split('|').filter(Boolean).map(entry => {
    const m = entry.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(feat|fix|update|note):\s*(.+)$/i);
    if (!m) return `<div class="update-entry"><span class="update-date"></span><span class="update-text">${escHtml(entry.trim())}</span></div>`;
    return `<div class="update-entry">
      <span class="update-date">${escHtml(m[1].slice(5))}</span>
      <span class="update-type ${m[2].toLowerCase()}">${escHtml(m[2])}</span>
      <span class="update-text">${escHtml(m[3])}</span>
    </div>`;
  }).join('');

  /* ── GitHub commits ────────────────────────────────────────────────────── */
  let ghSection = '';
  if (gh && !gh._private && !gh._rateLimit) {
    const commitHtml = (gh.commits || []).slice(0, 6).map(c => `
      <div class="commit-row">
        <span class="commit-sha">${escHtml(c.sha)}</span>
        <span class="commit-msg">${escHtml(c.message)}</span>
        <span class="commit-date">${relTime(c.date)}</span>
      </div>`).join('');
    ghSection = `<div class="so-section">
      <div class="so-section-label">Recent Commits</div>
      <div class="commits-list">${commitHtml || '<span style="color:var(--t3);font-size:12px">No commits found</span>'}</div>
    </div>`;
  }

  /* ── Similar projects ──────────────────────────────────────────────────── */
  const similar = getSimilar(p, NX.allProjects);
  const simHtml = similar.length
    ? similar.map(s => `
        <div class="similar-card" onclick="openDetail(${NX.allProjects.indexOf(s.project)})">
          <div class="similar-top">
            <span class="similar-name">${escHtml(s.project.name)}</span>
            <span class="similar-score">${s.score}%</span>
          </div>
          <div class="similar-reasons">${escHtml(s.reasons.join(' · '))}</div>
        </div>`).join('')
    : '<span style="color:var(--t3);font-size:12px">No similar projects found yet</span>';

  /* ── Language breakdown ────────────────────────────────────────────────── */
  const langBreakdown = gh?.languages?.length
    ? `<div class="so-section">
        <div class="so-section-label">Languages</div>
        <div class="so-tags">${gh.languages.map(l =>
          `<span class="lang-pill">
            <span class="lang-dot" style="background:${LANG_COLORS[l.lang] || 'var(--t3)'}"></span>
            ${escHtml(l.lang)}<span class="lang-pct">${l.pct}%</span>
          </span>`).join('')}
        </div>
      </div>`
    : '';

  const stack = (p.tech_stack || '').split(',').filter(Boolean).map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('');
  const tags  = (p.tags       || '').split(',').filter(Boolean).map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('');

  /* ── Render body ───────────────────────────────────────────────────────── */
  el('so-body').innerHTML = `
    <div class="so-name">${escHtml(p.name)}</div>
    <div class="so-badges">
      <span style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${statusCol}">
        <span class="status-dot ${p.status || 'paused'}" style="width:7px;height:7px"></span>
        ${escHtml((p.status || '').toUpperCase())}
      </span>
      ${p.team  ? `<span class="team-badge" style="background:${teamCol}18;color:${teamCol}">${escHtml(teamLabel(p.team))}</span>` : ''}
      ${p.owner ? `<span style="font-size:12px;color:var(--t2)">${escHtml(p.owner)}</span>` : ''}
    </div>

    ${p.description || p.one_liner
      ? `<div class="so-section"><div class="so-section-label">About</div><div class="so-desc">${escHtml(p.description || p.one_liner)}</div></div>`
      : ''}

    <div class="so-section">
      <div class="so-section-label">Details</div>
      <div class="so-detail-grid">
        ${p.domain         ? `<div class="so-detail-item"><label>Domain</label><span>${escHtml(p.domain)}</span></div>` : ''}
        ${p.client         ? `<div class="so-detail-item"><label>Client</label><span>${escHtml(p.client)}</span></div>` : ''}
        ${p.last_updated   ? `<div class="so-detail-item"><label>Last Updated</label><span>${escHtml(p.last_updated)}</span></div>` : ''}
        ${gh?.language     ? `<div class="so-detail-item"><label>Language</label><span>${escHtml(gh.language)}</span></div>` : ''}
        ${gh?.stars  != null ? `<div class="so-detail-item"><label>Stars</label><span>⭐ ${gh.stars}</span></div>` : ''}
        ${gh?.forks  != null ? `<div class="so-detail-item"><label>Forks</label><span>${gh.forks}</span></div>` : ''}
        ${gh?.open_issues != null ? `<div class="so-detail-item"><label>Open Issues</label><span>${gh.open_issues}</span></div>` : ''}
      </div>
    </div>

    ${p.deploy_url ? `
    <div class="so-section">
      <div class="so-section-label">Access</div>
      <a class="so-access-btn" href="${escHtml(p.deploy_url)}" target="_blank" rel="noopener">
        <span class="live-dot" style="width:7px;height:7px"></span>
        Open ${escHtml(p.name)} →
      </a>
    </div>` : ''}
    ${stack ? `<div class="so-section"><div class="so-section-label">Tech Stack</div><div class="so-tags">${stack}</div></div>` : ''}
    ${tags  ? `<div class="so-section"><div class="so-section-label">Tags</div><div class="so-tags">${tags}</div></div>`       : ''}
    ${langBreakdown}
    ${ghSection}
    ${similar.length
      ? `<div class="so-section"><div class="so-section-label">Similar Projects</div><div class="similar-list">${simHtml}</div></div>`
      : ''}
    ${updates
      ? `<div class="so-section"><div class="so-section-label">Update Log</div><div class="update-log">${updates}</div></div>`
      : ''}
  `;

  NX.currentDetailProject = p;
  const delBtn = el('so-delete-btn');
  if (delBtn) delBtn.style.display = p._mine ? 'block' : 'none';

  el('slideover').classList.add('open');
  el('overlay').classList.add('open');   /* BUG FIX: was 'so-overlay', element ID is 'overlay' */
}

function closeDetail() {
  el('slideover').classList.remove('open');
  el('overlay').classList.remove('open'); /* BUG FIX: was 'so-overlay' */
  NX.currentDetailProject = null;
}
