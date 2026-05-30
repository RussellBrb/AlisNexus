/* ── data.js — project data access (Supabase CRUD) ───────────────────────── */
/* The data layer. loadProjects() fetches + normalizes into NX.allProjects and
   returns { error }. Rendering and orchestration live in js/app/controller.js;
   this file never touches the DOM or the view functions. */
'use strict';

/* Load + normalize all projects into NX.allProjects. Returns { error }. */
async function loadProjects() {
  console.log('[nexus data] loading projects…');
  let data = null, error = null;
  try {
    /* Race the query against a timeout so a hung/deadlocked client never spins forever */
    const res = await Promise.race([
      _sb.from('projects').select('*').order('created_at', { ascending: false }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out after 15s')), 15000)),
    ]);
    data = res.data; error = res.error;
    console.log('[nexus data] projects query returned →', data ? data.length + ' rows' : 'no data', '| error:', error?.message || null);
  } catch (e) {
    error = e;
    console.error('[nexus data] projects query failed/timed out:', e);
  }

  if (error) {
    console.error('Supabase load error:', error);
    NX.allProjects = [];
    return { error };
  }

  /* Carry over existing GitHub enrichment so realtime reloads don't re-fetch */
  const prevGH = {};
  NX.allProjects.forEach(p => { if (p.github_url && p._github) prevGH[p.github_url] = p._github; });

  NX.allProjects = (data || []).map(row => ({
    _id:           row.id,
    _supabase:     true,
    _mine:         !!(NX.supabaseUser && row.created_by === NX.supabaseUser.id),
    _created_at:   row.created_at    || '',
    name:          row.name          || '',
    github_url:    row.github_url    || '',
    deploy_url:    row.deploy_url    || '',
    one_liner:     row.one_liner     || '',
    description:   row.description  || '',
    tags:          row.tags          || '',
    domain:        row.domain        || '',
    tech_stack:    row.tech_stack    || '',
    team:          row.team          || '',
    status:        row.status        || 'active',
    owner:         row.owner         || '',
    client:        row.client        || '',
    last_updated:  row.last_updated  || '',
    latest_update: row.latest_update || '',
    update_log:    row.update_log    || '',
  }));

  /* Restore cached GitHub data for unchanged repos */
  NX.allProjects.forEach(p => {
    if (p.github_url && prevGH[p.github_url]) p._github = prevGH[p.github_url];
  });

  return { error: null };
}

function refresh() {
  NX.ghCache = {};
  Object.keys(sessionStorage).filter(k => k.startsWith('gh_')).forEach(k => sessionStorage.removeItem(k));
  loadAndRender();
}

async function removeLocalProject(id) {
  if (!confirm('Remove this project?')) return;
  const { error } = await _sb.from('projects').delete().eq('id', id);
  if (error) { alert('Could not remove: ' + error.message); return; }
  loadAndRender();
}

async function deleteCurrentProject() {
  const p = NX.currentDetailProject;
  if (!p || !p._mine) return;
  if (!confirm(`Remove "${p.name}" from Nexus?`)) return;
  const { error } = await _sb.from('projects').delete().eq('id', p._id);
  if (error) { alert('Could not remove: ' + error.message); return; }
  closeDetail();
  loadAndRender();
}
