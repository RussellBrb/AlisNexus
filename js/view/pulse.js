/* ── pulse.js — live activity feed for the CS AI Builder Network ──────────── */
'use strict';

const PULSE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000; // 21 days back for activity

/* ── Event types ─────────────────────────────────────────────────────────── */
const PULSE_ICONS = {
  added:    '✦',  // new project
  commits:  '⬡',  // github activity
  live:     '◈',  // deploy_url available
  active:   '▸',  // status → active
};

function _msAgo(dateStr) {
  if (!dateStr) return Infinity;
  return Date.now() - new Date(dateStr).getTime();
}

/* ── Build activity events from current project + GitHub data ────────────── */
function buildPulseEvents(projects) {
  const events = [];

  projects.forEach(p => {
    const addedMs = _msAgo(p._created_at);

    /* Project added recently */
    if (addedMs < PULSE_WINDOW_MS) {
      events.push({
        type:    'added',
        project: p,
        label:   `${p.owner || 'Someone'} added ${p.name}`,
        sub:     p.one_liner || '',
        ts:      new Date(p._created_at).getTime(),
        icon:    PULSE_ICONS.added,
      });
    }

    /* Available to use (has deploy URL) */
    if (p.deploy_url) {
      events.push({
        type:    'live',
        project: p,
        label:   `${p.name} is live and available`,
        sub:     'Click to try it →',
        ts:      new Date(p._created_at).getTime() + 1, // show just after "added"
        icon:    PULSE_ICONS.live,
        url:     p.deploy_url,
      });
    }

    /* Recent GitHub commit activity */
    const commits = p._github?.commits || [];
    if (commits.length && commits[0].date) {
      const commitMs = _msAgo(commits[0].date);
      if (commitMs < PULSE_WINDOW_MS) {
        const n = commits.filter(c => _msAgo(c.date) < 7 * 24 * 60 * 60 * 1000).length;
        events.push({
          type:    'commits',
          project: p,
          label:   `${p.name} is shipping`,
          sub:     n > 1
            ? `${n} commits this week · latest: ${commits[0].message}`
            : commits[0].message,
          ts:      new Date(commits[0].date).getTime(),
          icon:    PULSE_ICONS.commits,
        });
      }
    }
  });

  /* Sort newest first, dedupe by project+type, cap at 10 */
  const seen = new Set();
  return events
    .sort((a, b) => b.ts - a.ts)
    .filter(e => {
      const key = `${e.type}:${e.project._id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

/* ── Relative time (compact) ─────────────────────────────────────────────── */
function _pulseTime(ts) {
  const d = Math.floor((Date.now() - ts) / 60000); // minutes
  if (d < 1)   return 'just now';
  if (d < 60)  return `${d}m ago`;
  const h = Math.floor(d / 60);
  if (h < 24)  return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/* ── Render a single pulse event ─────────────────────────────────────────── */
function _renderPulseEvent(e, teamCol) {
  const time = _pulseTime(e.ts);
  const isLive = e.type === 'live';

  return `<div class="pulse-event${isLive ? ' pulse-event--live' : ''}"
               onclick="openDetail('${e.project._id}')"
               style="--tc:${teamCol}">
    <span class="pulse-evt-icon" style="color:${teamCol}">${e.icon}</span>
    <div class="pulse-evt-body">
      <div class="pulse-evt-label">${escHtml(e.label)}</div>
      ${e.sub ? `<div class="pulse-evt-sub">${escHtml(e.sub.slice(0, 80))}${e.sub.length > 80 ? '…' : ''}</div>` : ''}
    </div>
    <div class="pulse-evt-meta">
      <span class="pulse-evt-time">${time}</span>
      ${isLive && e.url
        ? `<a class="pulse-try-btn" href="${escHtml(safeUrl(e.url))}" target="_blank" rel="noopener"
              onclick="event.stopPropagation()">Try it →</a>`
        : ''}
    </div>
  </div>`;
}

/* ── Main render ─────────────────────────────────────────────────────────── */
function renderPulse() {
  const wrap = el('pulse-wrap');
  if (!wrap) return;

  const events = buildPulseEvents(NX.allProjects);

  if (!events.length) {
    wrap.innerHTML = `
      <div class="pulse-empty">
        <span class="pulse-empty-icon">◎</span>
        <span>The network is quiet. Ship something and light it up.</span>
      </div>`;
    return;
  }

  const rows = events.map(e => {
    const col = teamColor(e.project.team);
    return _renderPulseEvent(e, col);
  }).join('');

  wrap.innerHTML = rows;
}
