/* ── core/health.js — project health scoring (pure domain) ───────────────── */
/* No DOM, no IO. Given a project (+ its enriched _github data), returns a tier.
   The chips, bar, filter, and detail block live in js/view/health-view.js. */
'use strict';

const HEALTH_TIERS = {
  hot:      { label: 'Hot',      icon: '🔥', color: '#f97316', score: 4 },
  steady:   { label: 'Steady',   icon: '✦',  color: '#22c55e', score: 3 },
  slowing:  { label: 'Slowing',  icon: '↓',  color: '#eab308', score: 2 },
  quiet:    { label: 'Quiet',    icon: '○',  color: '#6b7280', score: 1 },
  paused:   { label: 'Paused',   icon: '⏸',  color: 'var(--paused)', score: 0 },
  planning: { label: 'Planning', icon: '◦',  color: 'var(--planning)', score: 0 },
  nodata:   { label: 'No data',  icon: '?',  color: 'var(--t3)', score: -1 },
};

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
  return HEALTH_TIERS.quiet;
}
