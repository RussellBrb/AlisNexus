/* ── app.js — event bindings, search debounce, boot ─────────────────────── */
'use strict';

/* ── Search with debounce (120ms) ────────────────────────────────────────── */
let _searchTimer = null;
el('search-input').addEventListener('input', () => {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(renderAll, 120);
});

/* ── Wire up URL input and language selector once DOM is ready ───────────── */
/* Scripts load at end of <body> so the DOM is already available here */
initUrlInput();   /* defined in modal.js */
initLangInput();  /* defined in modal.js */

/* ── Boot auth (must run last — depends on all modules above being loaded) ── */
bootAuth();       /* defined in auth.js */
