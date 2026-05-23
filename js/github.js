/* ── github.js — GitHub API enrichment, token dialog ─────────────────────── */
'use strict';

function ghHeaders() {
  const h = { Accept: 'application/vnd.github.v3+json' };
  if (NX.ghToken) h.Authorization = 'token ' + NX.ghToken;
  return h;
}

function parseGHUrl(url) {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null;
}

async function fetchRepoData(owner, repo) {
  const key = `${owner}/${repo}`;

  /* Memory cache */
  if (NX.ghCache[key]) return NX.ghCache[key];

  /* Session cache (survives soft navigations, cleared on refresh) */
  const cached = sessionStorage.getItem('gh_' + key);
  if (cached) {
    try { NX.ghCache[key] = JSON.parse(cached); return NX.ghCache[key]; } catch (_) {}
  }

  try {
    const [repoRes, commitsRes, langsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${key}`,                    { headers: ghHeaders() }),
      fetch(`https://api.github.com/repos/${key}/commits?per_page=8`, { headers: ghHeaders() }),
      fetch(`https://api.github.com/repos/${key}/languages`,          { headers: ghHeaders() }),
    ]);

    if (!repoRes.ok) {
      if (repoRes.status === 403) return { _rateLimit: true };
      if (repoRes.status === 404 && !NX.ghToken) return { _private: true };
      return null;
    }

    const repoData   = await repoRes.json();
    const commits    = commitsRes.ok ? await commitsRes.json() : [];
    const langsRaw   = langsRes.ok  ? await langsRes.json()   : {};
    const totalBytes = Object.values(langsRaw).reduce((s, v) => s + v, 0);

    const enriched = {
      language:       repoData.language,
      description:    repoData.description,
      languages:      Object.entries(langsRaw)
                        .sort((a, b) => b[1] - a[1])
                        .map(([lang, bytes]) => ({
                          lang,
                          pct: totalBytes ? Math.round(bytes / totalBytes * 1000) / 10 : 0,
                        })),
      topics:         repoData.topics || [],
      stars:          repoData.stargazers_count,
      forks:          repoData.forks_count,
      open_issues:    repoData.open_issues_count,
      pushed_at:      repoData.pushed_at,
      default_branch: repoData.default_branch,
      commits:        (Array.isArray(commits) ? commits : []).map(c => ({
        sha:    c.sha ? c.sha.slice(0, 7) : '',
        message: c.commit?.message?.split('\n')[0] || '',
        date:   c.commit?.author?.date?.slice(0, 10) || '',
        author: c.commit?.author?.name || '',
      })),
    };

    NX.ghCache[key] = enriched;
    try { sessionStorage.setItem('gh_' + key, JSON.stringify(enriched)); } catch (_) {}
    return enriched;
  } catch (_) {
    return null;
  }
}

async function enrichAllWithGitHub(projects) {
  const withGH = projects.filter(p => p.github_url);
  if (!withGH.length) return;

  el('last-upd').textContent = 'Enriching from GitHub…';

  await Promise.allSettled(withGH.map(async p => {
    const parsed = parseGHUrl(p.github_url);
    if (!parsed) return;
    const data = await fetchRepoData(parsed.owner, parsed.repo);
    if (data) p._github = data;
  }));

  /* Only prompt for token if there are private repos and no token is saved */
  const hasPrivate = withGH.some(p => p._github?._private);
  if (hasPrivate && !NX.ghToken) el('token-dialog').classList.add('open');

  el('last-upd').textContent = `Updated ${new Date().toLocaleTimeString()} · live`;
  renderAll();
  renderPulse(); /* refresh pulse with commit data now available */
}

/* ── Token dialog ────────────────────────────────────────────────────────── */
function closeTokenDialog() { el('token-dialog').classList.remove('open'); }

async function saveToken() {
  const val = el('token-input').value.trim();
  if (val) {
    NX.ghToken = val;
    NX.ghCache = {};
    Object.keys(sessionStorage).filter(k => k.startsWith('gh_')).forEach(k => sessionStorage.removeItem(k));
    /* Persist to Supabase metadata so the token loads on any device at next login */
    if (NX.supabaseUser) await _sb.auth.updateUser({ data: { gh_token: val } });
  }
  closeTokenDialog();
  enrichAllWithGitHub(NX.allProjects);
}
