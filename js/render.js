/* ── render.js — cards, filters, contributor chips, metrics ──────────────── */
'use strict';

/* ── Formatting helpers ──────────────────────────────────────────────────── */
function relTime(dateStr) {
  if (!dateStr) return '—';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 30)  return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function teamClass(team)  { return team ? 'team-' + team.toLowerCase().replace(/\s+/g, '-') : ''; }
function teamColor(team)  { return TEAM_COLORS[team] || 'var(--t3)'; }
function teamLabel(team)  { return TEAM_LABELS[team] || team || ''; }
function ownerInitials(n) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'; }

/* ── Card ────────────────────────────────────────────────────────────────── */
function renderCard(p, idx) {
  const gh       = p._github;
  const statusCls = (p.status || 'paused').toLowerCase();
  const commit   = gh?.commits?.[0];
  const teamCol  = teamColor(p.team);

  let ghSection = '';
  if (p.github_url) {
    if (!gh) {
      ghSection = `<div class="gh-bar"><span class="gh-loading">Loading from GitHub…</span></div>`;
    } else if (gh._private) {
      ghSection = `<div class="gh-bar"><span class="gh-private">🔒 Private repo</span></div>`;
    } else if (gh._rateLimit) {
      ghSection = `<div class="gh-bar"><span class="gh-loading">Rate limited</span></div>`;
    } else {
      const langDot = gh.language
        ? `<span class="lang-dot" style="background:${LANG_COLORS[gh.language] || 'var(--t3)'}"></span>`
        : '';
      ghSection = `<div class="gh-bar">
        ${gh.language ? `<span class="gh-lang">${langDot}${escHtml(gh.language)}</span>` : ''}
        ${commit ? `<span class="gh-commit">${escHtml(commit.message)}</span><span class="gh-age">${relTime(commit.date)}</span>` : ''}
      </div>`;
    }
  }

  const tags       = (p.tags || '').split(',').filter(Boolean).slice(0, 4);
  const tagHtml    = tags.map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('');
  const ownerAv    = p.owner ? `<div class="owner-av" style="background:${teamCol}22;color:${teamCol}">${ownerInitials(p.owner)}</div>` : '';
  const mineCls    = p._mine ? 'is-mine' : '';
  const liveCls    = p.deploy_url ? 'has-deploy' : '';
  const localBadge = p._mine
    ? `<button class="local-badge" data-remove-id="${escHtml(p._id)}" title="Remove my project" onclick="event.stopPropagation();removeLocalProject(this.dataset.removeId)">✕</button>`
    : '';
  const liveBadge  = p.deploy_url
    ? `<span class="live-badge"><span class="live-dot"></span>LIVE</span>`
    : '';
  const tryBtn     = p.deploy_url
    ? `<a class="card-try-btn" href="${escHtml(safeUrl(p.deploy_url))}" target="_blank" rel="noopener"
          onclick="event.stopPropagation()">Try it →</a>`
    : '';

  return `<div class="card ${teamClass(p.team)} ${mineCls} ${liveCls} stagger-${Math.min(idx + 1, 5)}" onclick="openDetail('${p._id}')">
    ${localBadge}
    ${liveBadge}
    <div class="card-top">
      <div class="card-name">${escHtml(p.name)}</div>
      <div class="status-dot ${statusCls}"></div>
    </div>
    ${p.one_liner ? `<div class="card-one-liner">${escHtml(p.one_liner)}</div>` : ''}
    ${tagHtml ? `<div class="card-tags">${tagHtml}</div>` : ''}
    ${ghSection}
    <div class="card-foot">
      <div class="owner-chip">
        ${ownerAv}
        <span class="owner-name">${escHtml(p.owner)}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${tryBtn}
        ${p.team ? `<span class="team-badge" style="background:${teamCol}18;color:${teamCol}">${escHtml(teamLabel(p.team))}</span>` : ''}
        <span class="card-date">${relTime(p.last_updated)}</span>
      </div>
    </div>
  </div>`;
}

/* ── Main grid render ────────────────────────────────────────────────────── */
function renderAll() {
  const query = (el('search-input').value || '').toLowerCase();

  NX.filtered = NX.allProjects.filter(p => {
    const teamMatch   = NX.activeTeam   === 'all' || p.team   === NX.activeTeam;
    const statusMatch = NX.activeStatus === 'all' || p.status === NX.activeStatus;
    const ownerMatch  = NX.activeOwner  === 'all' || p.owner  === NX.activeOwner;
    const searchMatch = !query || [p.name, p.one_liner, p.description, p.tags, p.owner]
                          .join(' ').toLowerCase().includes(query);
    return teamMatch && statusMatch && ownerMatch && searchMatch;
  });

  const grid = el('grid');
  if (!NX.filtered.length) {
    const emptyMsg = (!query && NX.activeTeam === 'all' && NX.activeStatus === 'all')
      ? `<div class="empty-state"><div class="empty-icon">🚀</div><div class="empty-title">No projects yet</div><div class="empty-sub">Hit <strong>+ Add Project</strong> to add your first repo.</div></div>`
      : `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No projects found</div><div class="empty-sub">Try adjusting your filters or search.</div></div>`;
    grid.innerHTML = emptyMsg;
    renderFilters();
    return;
  }

  grid.innerHTML = NX.filtered.map((p, i) => renderCard(p, i)).join('');
  renderFilters();
}

/* ── Filters + contributor chips ─────────────────────────────────────────── */
function renderFilters() {
  const teams    = [...new Set(NX.allProjects.map(p => p.team).filter(Boolean))];
  const statuses = [...new Set(NX.allProjects.map(p => p.status).filter(Boolean))];

  /* Team pills */
  const teamPills = ['all', ...teams].map(t => {
    const col   = t === 'all' ? 'var(--accent)' : teamColor(t);
    const label = t === 'all' ? 'All' : teamLabel(t);
    const count = t === 'all' ? NX.allProjects.length : NX.allProjects.filter(p => p.team === t).length;
    const act   = NX.activeTeam === t ? 'active' : '';
    return `<button class="pill ${act}" style="${act ? `background:${col};` : ''}" onclick="setTeam(${JSON.stringify(t)})">${escHtml(label)} <span style="opacity:.6">${count}</span></button>`;
  }).join('');

  /* Status pills */
  const statusPills = ['all', 'active', 'planning', 'paused']
    .filter(s => s === 'all' || statuses.includes(s))
    .map(s => {
      const cols  = { active: 'var(--active)', planning: 'var(--planning)', paused: 'var(--paused)', all: 'var(--accent)' };
      const col   = cols[s];
      const label = s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1);
      const act   = NX.activeStatus === s ? 'active' : '';
      return `<button class="pill ${act}" style="${act ? `background:${col};` : ''}" onclick="setStatus(${JSON.stringify(s)})">${s !== 'all' ? `<span class="dot" style="background:${col}"></span>` : ''}${escHtml(label)}</button>`;
    }).join('');

  el('filters').innerHTML =
    `<div class="filter-group">${teamPills}</div><div class="filter-divider"></div><div class="filter-group">${statusPills}</div>`;

  /* Contributor chips */
  const owners     = [...new Set(NX.allProjects.map(p => p.owner).filter(Boolean))];
  const contribRow = el('contrib-row');
  if (!contribRow) return;

  if (owners.length > 1) {
    const myName = NX.userProfile?.name || '';
    const chips  = owners.map(name => {
      const proj   = NX.allProjects.find(p => p.owner === name);
      const col    = proj ? teamColor(proj.team) : 'var(--accent)';
      const count  = NX.allProjects.filter(p => p.owner === name).length;
      const act    = NX.activeOwner === name ? 'active' : '';
      const style  = act ? `background:${col};border-color:${col}` : '';
      const youTag = name === myName ? `<span class="you-tag">you</span>` : '';
      /* Use JSON.stringify to safely encode any name (incl. apostrophes) */
      return `<button class="contrib-chip ${act}" style="${style}" onclick="setOwner(${JSON.stringify(name)})">
        <div class="ca" style="background:${col}22;color:${col}">${ownerInitials(name)}</div>
        <span class="cn">${escHtml(name)}</span>${youTag}
        <span class="cc">${count}</span>
      </button>`;
    }).join('');

    const allAct   = NX.activeOwner === 'all' ? 'active' : '';
    const allStyle = NX.activeOwner === 'all' ? 'background:var(--accent);border-color:var(--accent)' : '';
    contribRow.innerHTML = `<span class="contrib-label">People</span>
      <button class="contrib-chip ${allAct}" style="${allStyle}" onclick="setOwner('all')">
        <div class="ca" style="background:var(--accent)22;color:var(--accent)">All</div>
        <span class="cn">Everyone</span><span class="cc">${NX.allProjects.length}</span>
      </button>${chips}`;
  } else {
    NX.activeOwner       = 'all'; /* I6: clear stuck filter when row disappears */
    contribRow.innerHTML = '';
  }
}

/* ── Metrics ─────────────────────────────────────────────────────────────── */
function updateMetrics() {
  const active = NX.allProjects.filter(p => p.status === 'active').length;
  const owners = new Set(NX.allProjects.map(p => p.owner).filter(Boolean)).size;
  const issues = NX.allProjects.reduce((s, p) => s + (p._github?.open_issues || 0), 0);
  el('hero-metrics').innerHTML = `
    <div class="metric pulse"><div class="metric-val">${active}</div><div class="metric-label">Active</div></div>
    <div class="metric"><div class="metric-val">${NX.allProjects.length}</div><div class="metric-label">Projects</div></div>
    <div class="metric"><div class="metric-val">${owners}</div><div class="metric-label">Contributors</div></div>
    <div class="metric"><div class="metric-val">${issues || '—'}</div><div class="metric-label">Open Issues</div></div>`;
}

/* ── Filter setters ──────────────────────────────────────────────────────── */
function setTeam(t)   { NX.activeTeam   = t; renderAll(); }
function setStatus(s) { NX.activeStatus = s; renderAll(); }
function setOwner(o)  { NX.activeOwner  = o; renderAll(); }
