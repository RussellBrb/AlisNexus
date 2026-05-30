/* ── app/controller.js — view orchestration ──────────────────────────────── */
/* Bridges the data layer to the view: paints the loading state, asks the data
   layer to load, then renders grid + metrics + pulse, kicks off GitHub
   enrichment, and wires the realtime subscription. Keeping this here is what
   lets data.js stay free of any rendering. */
'use strict';

async function loadAndRender() {
  el('grid').innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>Loading projects…</div></div>';

  const { error } = await loadProjects();

  if (error) {
    el('grid').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⚠️</div>' +
      '<div class="empty-title">Couldn\'t load projects</div>' +
      '<div class="empty-sub">' + escHtml(error.message || 'Unknown error') +
      '<br>See the browser console for details, then hit Refresh.</div></div>';
    updateMetrics();
    renderPulse();
    return;
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
