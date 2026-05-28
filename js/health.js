/* ── health.js — project health / momentum scoring ───────────────────────── */
'use strict';

/* ── Tier definitions ────────────────────────────────────────────────────── */
const HEALTH_TIERS = {
  hot:      { label: 'Hot',      icon: '🔥', color: '#f97316', score: 4 },
  steady:   { label: 'Steady',   icon: '✦',  color: '#22c55e', score: 3 },
  slowing:  { label: 'Slowing',  icon: '↓',  color: '#eab308', score: 2 },
  stalled:  { label: 'Stalled',  icon: '○',  color: '#6b7280', score: 1 },
  paused:   { label: 'Paused',   icon: '⏸',  color: 'var(--paused)', score: 0 },
  planning: { label: 'Planning', icon: '◦',  color: 'var(--planning)', score: 0 },
  nodata:   { label: 'No data',  icon: '?',  color: 'var(--t3)', score: -1 },
};

/*
 * computeHealth(p) — returns a health tier object for a project.
 *
 * Scoring uses GitHub activity data (commits, pushed_at) against
 * time windows. Projects without GitHub links are "nodata".
 * Paused/planning projects short-circuit to their status tier.
 */
function computeHealth(p) {
  /* Status short-circuits */
  if (p.status === 'paused')   return HEALTH_TIERS.paused;
  if (p.status === 'planning') return HEALTH_TIERS.planning;

  /* No GitHub link */
  if (!p.github_url) return HEALTH_TIERS.nodata;

  const gh = p._github;
  if (!gh || gh._rateLimit) return HEALTH_TIERS.nodata;
  if (gh._private)           return { ...HEALTH_TIERS.nodata, label: 'Private' };

  const now        = Date.now();
  const commits    = gh.commits || [];
  const pushedAt   = gh.pushed_at;

  const daysSincePush = pushedAt
    ? Math.floor((now - new Date(pushedAt).getTime()) / 86400000)
    : 999;

  const commitsThisWeek  = commits.filter(c =>
    c.date && (now - new Date(c.date).getTime()) < 7  * 86400000).length;
  const commitsThisMonth = commits.filter(c =>
    c.date && (now - new Date(c.date).getTime()) < 30 * 86400000).length;

  if (commitsThisWeek >= 2 || daysSincePush <= 2)           return HEALTH_TIERS.hot;
  if (commitsThisWeek >= 1 || daysSincePush <= 7)           return HEALTH_TIERS.steady;
  if (commitsThisMonth >= 1 || daysSincePush <= 21)         return HEALTH_TIERS.slowing;
  return HEALTH_TIERS.stalled;
}

/* ── Health chip HTML (used on cards and in detail panel) ────────────────── */
function healthChip(p, compact) {
  const h = computeHealth(p);
  if (h.score === -1) return '';   /* hide "no data" chips on cards */
  const size = compact ? 'health-chip--sm' : '';
  return `<span class="health-chip health-chip--${h.label.toLowerCase()} ${size}"
    style="--hc:${h.color}">${h.icon} ${h.label}</span>`;
}

/* ── Hero health bar ─────────────────────────────────────────────────────── */
function renderHealthBar() {
  const wrap = el('health-bar-wrap');
  if (!wrap) return;

  const active = NX.allProjects.filter(p => p.status === 'active');
  if (!active.length) { wrap.innerHTML = ''; return; }

  /* Count tiers (only for active projects — noise otherwise) */
  const counts = { hot: 0, steady: 0, slowing: 0, stalled: 0 };
  active.forEach(p => {
    const h = computeHealth(p);
    if (counts[h.label.toLowerCase()] !== undefined) counts[h.label.toLowerCase()]++;
  });

  const total = active.length;
  const tiers = [
    { key: 'hot',     ...HEALTH_TIERS.hot     },
    { key: 'steady',  ...HEALTH_TIERS.steady  },
    { key: 'slowing', ...HEALTH_TIERS.slowing },
    { key: 'stalled', ...HEALTH_TIERS.stalled },
  ].filter(t => counts[t.key] > 0);

  /* Stacked bar segments */
  const segments = tiers.map(t =>
    `<div class="hbar-seg" style="width:${counts[t.key]/total*100}%;background:${t.color}"
          title="${counts[t.key]} ${t.label}"
          onclick="setHealthFilter('${t.key}')"></div>`
  ).join('');

  /* Legend */
  const legend = tiers.map(t =>
    `<button class="hbar-leg" onclick="setHealthFilter('${t.key}')"
             style="--hc:${t.color}">
       <span class="hbar-leg-dot" style="background:${t.color}"></span>
       <span class="hbar-leg-label">${t.icon} ${t.label}</span>
       <span class="hbar-leg-count">${counts[t.key]}</span>
     </button>`
  ).join('');

  wrap.innerHTML = `
    <div class="hbar-header">
      <span class="hbar-title">Project Health</span>
      ${NX.activeHealth !== 'all'
        ? `<button class="hbar-clear" onclick="setHealthFilter('all')">✕ Clear filter</button>`
        : ''}
    </div>
    <div class="hbar-track">${segments}</div>
    <div class="hbar-legend">${legend}</div>`;
}

/* ── Health filter ───────────────────────────────────────────────────────── */
function setHealthFilter(tier) {
  NX.activeHealth = NX.activeHealth === tier ? 'all' : tier;
  renderAll();
  renderHealthBar();
}

/* ── Health detail block (used in Activity tab) ──────────────────────────── */
function healthDetailHtml(p) {
  const h     = computeHealth(p);
  const gh    = p._github;
  if (!gh || h.score === -1) return '';

  const now             = Date.now();
  const commits         = gh.commits || [];
  const commitsThisWeek = commits.filter(c =>
    c.date && (now - new Date(c.date).getTime()) < 7 * 86400000).length;
  const daysSincePush   = gh.pushed_at
    ? Math.floor((now - new Date(gh.pushed_at).getTime()) / 86400000)
    : null;

  const bars = [
    { label: 'Commits this week', val: commitsThisWeek, max: 7,  color: h.color },
    { label: 'Days since push',   val: daysSincePush ?? 0, max: 30, color: h.color, invert: true },
    { label: 'Open issues',       val: gh.open_issues || 0, max: 20, color: gh.open_issues > 5 ? '#f87171' : h.color },
  ];

  const barHtml = bars.map(b => {
    const pct = Math.min(b.val / b.max * 100, 100);
    const fillPct = b.invert ? (100 - pct) : pct;
    return `<div class="h-detail-row">
      <div class="h-detail-lbl">${b.label}</div>
      <div class="h-detail-track">
        <div class="h-detail-fill" style="width:${Math.max(fillPct, 2)}%;background:${b.color}"></div>
      </div>
      <div class="h-detail-val">${b.val ?? '—'}</div>
    </div>`;
  }).join('');

  return `<div class="h-detail-block">
    <div class="h-detail-score">
      <span class="health-chip" style="--hc:${h.color};font-size:13px;padding:5px 12px">
        ${h.icon} ${h.label}
      </span>
      <span class="h-detail-caption">Based on commit cadence &amp; push activity</span>
    </div>
    ${barHtml}
  </div>`;
}
