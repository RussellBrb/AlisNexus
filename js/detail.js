/* ── detail.js — slide-over project detail panel ─────────────────────────── */
'use strict';

/* ── Tab switching (called from onclick in rendered HTML) ─────────────────── */
function switchSoTab(tabName) {
  qsa('.so-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  qsa('.so-tab-panel').forEach(p => {
    p.style.display = p.dataset.panel === tabName ? 'block' : 'none';
  });
}

/* ── Language bars helper ────────────────────────────────────────────────── */
function _langBars(languages) {
  if (!languages?.length) return '';
  return `<div class="lang-bars">
    ${languages.slice(0, 7).map(l => `
      <div class="lang-bar-row">
        <div class="lang-bar-label">
          <span class="lang-dot" style="background:${LANG_COLORS[l.lang] || 'var(--t3)'}"></span>
          <span class="lang-bar-name">${escHtml(l.lang)}</span>
        </div>
        <div class="lang-bar-track">
          <div class="lang-bar-fill" style="width:${Math.max(l.pct, 2)}%;background:${LANG_COLORS[l.lang] || 'var(--t3)'}"></div>
        </div>
        <span class="lang-bar-pct">${l.pct}%</span>
      </div>`).join('')}
  </div>`;
}

/* ── Repo stat tile helper ───────────────────────────────────────────────── */
function _statTile(label, value, color) {
  if (value == null || value === '') return '';
  return `<div class="so-stat-tile">
    <div class="so-stat-val" style="color:${color || 'var(--t1)'}">${value}</div>
    <div class="so-stat-label">${label}</div>
  </div>`;
}

/* ── Format bytes (repo size from GitHub is KB) ─────────────────────────── */
function _fmtSize(kb) {
  if (!kb) return null;
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/* ── Main open ───────────────────────────────────────────────────────────── */
function openDetail(id) {
  const p = NX.allProjects.find(p => p._id === id);
  if (!p) return;

  el('so-breadcrumb').textContent = teamLabel(p.team) || 'Project';
  const gh       = p._github;
  const teamCol  = teamColor(p.team);
  const statusCols = { active: 'var(--active)', planning: 'var(--planning)', paused: 'var(--paused)' };
  const statusCol  = statusCols[p.status] || 'var(--t3)';

  /* ── Shared header — always visible above tabs ─────────────────────────── */
  /* Pull the best available description: DB field → one-liner → GitHub description */
  const oneLiner    = p.one_liner   || gh?.description || '';
  const fullDesc    = p.description || '';
  /* Show both if they're meaningfully different, otherwise just one */
  const descIsDiff  = fullDesc && fullDesc.toLowerCase() !== oneLiner.toLowerCase();

  const header = `
    <div class="so-name">${escHtml(p.name)}</div>
    <div class="so-badges">
      <span style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${statusCol}">
        <span class="status-dot ${p.status || 'paused'}" style="width:7px;height:7px"></span>
        ${escHtml((p.status || '').toUpperCase())}
      </span>
      ${p.team  ? `<span class="team-badge" style="background:${teamCol}18;color:${teamCol}">${escHtml(teamLabel(p.team))}</span>` : ''}
      ${p.owner ? `<span style="font-size:12px;color:var(--t2)">${escHtml(p.owner)}</span>` : ''}
      ${p.deploy_url ? `<span class="live-badge" style="position:static"><span class="live-dot"></span>LIVE</span>` : ''}
    </div>
    ${oneLiner ? `<div class="so-one-liner">${escHtml(oneLiner)}</div>` : ''}
    ${descIsDiff ? `<div class="so-full-desc">${escHtml(fullDesc)}</div>` : ''}
    ${p.deploy_url ? `
      <a class="so-access-btn so-access-inline" href="${escHtml(safeUrl(p.deploy_url))}" target="_blank" rel="noopener">
        <span class="live-dot" style="width:7px;height:7px"></span>
        Open ${escHtml(p.name)} →
      </a>` : ''}
    <div class="so-header-divider"></div>`;

  /* ── Tab nav ───────────────────────────────────────────────────────────── */
  const tabs = `
    <div class="so-tabs">
      <button class="so-tab active" data-tab="overview"  onclick="switchSoTab('overview')">Overview</button>
      <button class="so-tab"        data-tab="activity"  onclick="switchSoTab('activity')">Activity</button>
      <button class="so-tab"        data-tab="details"   onclick="switchSoTab('details')">Details</button>
    </div>`;

  /* ── Overview tab ──────────────────────────────────────────────────────── */
  const readmeText = gh?.readme || '';
  const topics     = gh?.topics || [];
  const topicHtml  = topics.length
    ? `<div class="so-section"><div class="so-section-label">Topics</div>
        <div class="so-topics">${topics.map(t => `<span class="so-topic">${escHtml(t)}</span>`).join('')}</div>
       </div>`
    : '';

  /* Smart README: extract intro callout + reorder sections */
  const { intro: rdIntro, body: rdBody } = reorderReadme(readmeText);
  const introHtml = rdIntro
    ? `<div class="readme-intro md-body">${renderMd(rdIntro)}</div>`
    : '';
  const bodyHtml = rdBody
    ? `<div class="readme-preview md-body">${renderMd(rdBody)}</div>`
    : '';
  const readmeHtml = (rdIntro || rdBody)
    ? `<div class="so-section">
        <div class="so-section-label">README</div>
        ${introHtml}${bodyHtml}
       </div>`
    : '';

  const overviewPanel = `
    <div class="so-tab-panel" data-panel="overview">
      ${topicHtml}
      ${readmeHtml}
      ${!readmeText ? `<div class="so-section">
        <span style="color:var(--t3);font-size:13px">
          No README found. Add one to the GitHub repo for it to appear here.
        </span></div>` : ''}
    </div>`;

  /* ── Activity tab ──────────────────────────────────────────────────────── */
  let activityPanel = '';
  if (gh && !gh._private && !gh._rateLimit) {
    const commits = gh.commits || [];
    const last7   = commits.filter(c => relTime(c.date) !== '—' &&
      (Date.now() - new Date(c.date).getTime()) < 7 * 86400000).length;
    const pushedAgo = gh.pushed_at ? relTime(gh.pushed_at.slice(0, 10)) : null;

    const commitRows = commits.slice(0, 8).map(c => `
      <div class="commit-row">
        <span class="commit-sha">${escHtml(c.sha)}</span>
        <span class="commit-msg">${escHtml(c.message)}</span>
        <span class="commit-date">${relTime(c.date)}</span>
      </div>`).join('');

    const activityStats = `
      <div class="so-activity-stats">
        ${pushedAgo ? _statTile('Last Push', pushedAgo, 'var(--t1)') : ''}
        ${_statTile('This Week', `${last7} commit${last7 !== 1 ? 's' : ''}`, last7 > 0 ? 'var(--active)' : 'var(--t3)')}
        ${_statTile('Total Shown', `${commits.length}`, 'var(--t1)')}
      </div>`;

    activityPanel = `
      <div class="so-tab-panel" data-panel="activity" style="display:none">
        <div class="so-section">
          ${healthDetailHtml(p)}
        </div>
        <div class="so-section">
          ${activityStats}
        </div>
        <div class="so-section">
          <div class="so-section-label">Recent Commits</div>
          <div class="commits-list">
            ${commitRows || '<span style="color:var(--t3);font-size:12px">No commits found</span>'}
          </div>
        </div>
      </div>`;
  } else {
    const msg = gh?._private  ? '🔒 Private repository — add a GitHub token to view activity'
              : gh?._rateLimit ? 'Rate limited — add a GitHub token for higher limits'
              : 'Add a GitHub URL to this project to see commit activity';
    activityPanel = `
      <div class="so-tab-panel" data-panel="activity" style="display:none">
        <div class="so-section"><span style="color:var(--t3);font-size:13px">${msg}</span></div>
      </div>`;
  }

  /* ── Details tab ───────────────────────────────────────────────────────── */
  const langHtml     = _langBars(gh?.languages);
  const stack        = (p.tech_stack || '').split(',').filter(Boolean);
  const tags         = (p.tags       || '').split(',').filter(Boolean);

  const statsHtml = (gh && !gh._private && !gh._rateLimit) ? `
    <div class="so-section">
      <div class="so-section-label">Repository Stats</div>
      <div class="so-stat-grid">
        ${_statTile('Stars',  gh.stars  != null ? '⭐ ' + gh.stars  : null, 'var(--planning)')}
        ${_statTile('Forks',  gh.forks  != null ? gh.forks           : null, 'var(--t1)')}
        ${_statTile('Issues', gh.open_issues != null ? gh.open_issues : null,
            gh.open_issues > 0 ? '#f87171' : 'var(--active)')}
        ${_statTile('Size',   _fmtSize(gh.size), 'var(--t1)')}
      </div>
    </div>` : '';

  const contribHtml = gh?.contributors?.length ? `
    <div class="so-section">
      <div class="so-section-label">Contributors</div>
      <div class="so-contrib-list">
        ${gh.contributors.map(c => `
          <div class="so-contrib-row">
            <div class="so-contrib-av">${escHtml(c.login.slice(0, 2).toUpperCase())}</div>
            <span class="so-contrib-name">${escHtml(c.login)}</span>
            <span class="so-contrib-count">${c.contributions} commit${c.contributions !== 1 ? 's' : ''}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  const ghLinkHtml = p.github_url ? `
    <div class="so-section">
      <a class="gh-link" href="${escHtml(safeUrl(p.github_url))}" target="_blank" rel="noopener">
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        View on GitHub
      </a>
    </div>` : '';

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

  const detailsPanel = `
    <div class="so-tab-panel" data-panel="details" style="display:none">
      ${statsHtml}
      ${langHtml ? `<div class="so-section"><div class="so-section-label">Languages</div>${langHtml}</div>` : ''}
      ${contribHtml}
      ${stack.length ? `<div class="so-section"><div class="so-section-label">Tech Stack</div><div class="so-tags">${stack.map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('')}</div></div>` : ''}
      ${tags.length  ? `<div class="so-section"><div class="so-section-label">Tags</div><div class="so-tags">${tags.map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('')}</div></div>` : ''}
      ${p.domain || p.client || p.last_updated ? `
        <div class="so-section">
          <div class="so-section-label">Details</div>
          <div class="so-detail-grid">
            ${p.domain       ? `<div class="so-detail-item"><label>Domain</label><span>${escHtml(p.domain)}</span></div>` : ''}
            ${p.client       ? `<div class="so-detail-item"><label>Client</label><span>${escHtml(p.client)}</span></div>` : ''}
            ${p.last_updated ? `<div class="so-detail-item"><label>Last Updated</label><span>${escHtml(p.last_updated)}</span></div>` : ''}
          </div>
        </div>` : ''}
      ${updates ? `<div class="so-section"><div class="so-section-label">Update Log</div><div class="update-log">${updates}</div></div>` : ''}
      ${ghLinkHtml}
      ${p.github_url && p.deploy_url ? '' : ghLinkHtml ? '' : ''}
    </div>`;

  /* ── Similar projects ──────────────────────────────────────────────────── */
  const similar = getSimilar(p, NX.allProjects);
  const simHtml = similar.length
    ? `<div class="so-section so-similar-section">
        <div class="so-section-label">Similar Projects</div>
        <div class="similar-list">
          ${similar.map(s => `
            <div class="similar-card" onclick="openDetail('${s.project._id}')">
              <div class="similar-top">
                <span class="similar-name">${escHtml(s.project.name)}</span>
                <span class="similar-score">${s.score}%</span>
              </div>
              <div class="similar-reasons">${escHtml(s.reasons.join(' · '))}</div>
            </div>`).join('')}
        </div>
       </div>`
    : '';

  /* ── Assemble ──────────────────────────────────────────────────────────── */
  el('so-body').innerHTML = header + tabs + overviewPanel + activityPanel + detailsPanel + simHtml;

  NX.currentDetailProject = p;
  const delBtn = el('so-delete-btn');
  if (delBtn) delBtn.style.display = p._mine ? 'block' : 'none';

  el('slideover').classList.add('open');
  el('overlay').classList.add('open');
}

function closeDetail() {
  el('slideover').classList.remove('open');
  el('overlay').classList.remove('open');
  NX.currentDetailProject = null;
}
