/* ── core/format.js — pure formatting & sanitization helpers ─────────────── */
/* No DOM, no IO, no state. Lowest layer, loaded first. The team helpers read
   the global TEAM_COLORS / TEAM_LABELS maps (config.js) at call time, so order
   of definition doesn't matter — guards keep this file safe on its own. */
'use strict';

/* Relative time, e.g. "today", "3d ago", "2mo ago" */
function relTime(dateStr) {
  if (!dateStr) return '—';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 30)  return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/* Team → CSS class / color / label */
function teamClass(team) { return team ? 'team-' + team.toLowerCase().replace(/\s+/g, '-') : ''; }
function teamColor(team) { return (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[team]) || 'var(--t3)'; }
function teamLabel(team) { return (typeof TEAM_LABELS !== 'undefined' && TEAM_LABELS[team]) || team || ''; }

/* Initials from a name, e.g. "Russell Bran" → "RB" */
function ownerInitials(n) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'; }

/* Escape user-supplied content before any innerHTML assignment */
function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Allow only http/https URLs — blocks javascript: and data: URIs */
function safeUrl(url) {
  if (!url) return '#';
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : '#';
}
