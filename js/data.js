/* ── data.js — Supabase CRUD, data loading, realtime subscription ────────── */
'use strict';

async function loadAndRender() {
  el('grid').innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>Loading projects…</div></div>';

  const { data, error } = await _sb.from('projects').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase load error:', error);
    NX.allProjects = [];
  } else {
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
  }

  renderAll();
  updateMetrics();
  renderPulse();
  enrichAllWithGitHub(NX.allProjects);

  /* Realtime subscription — set up once per page load */
  if (!NX._realtimeSetup) {
    NX._realtimeSetup = true;
    _sb.channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadAndRender())
      .subscribe();
  }
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
