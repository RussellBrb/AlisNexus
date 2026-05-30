/* ── view/health-view.js — health chips, bar, filter, detail block ───────── */
/* Rendering layer for health. Pure scoring lives in js/core/health.js. */
'use strict';

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
  const counts = { hot: 0, steady: 0, slowing: 0, quiet: 0 };
  active.forEach(p => {
    const h = computeHealth(p);
    if (counts[h.label.toLowerCase()] !== undefined) counts[h.label.toLowerCase()]++;
  });

  const total = active.length;
  const tiers = [
    { key: 'hot',     ...HEALTH_TIERS.hot     },
    { key: 'steady',  ...HEALTH_TIERS.steady  },
    { key: 'slowing', ...HEALTH_TIERS.slowing },
    { key: 'quiet',   ...HEALTH_TIERS.quiet   },
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
      <span class="hbar-title">Commit activity</span>
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
      <span class="h-detail-caption">Reflects GitHub commit cadence — a quiet score doesn't always mean inactive</span>
    </div>
    ${barHtml}
  </div>`;
}
