/* ── core/state.js — NX shared mutable store ─────────────────────────────── */
/* The single source of mutable app state. Plain object by design (the app reads
   and writes its fields directly). The localStorage-backed getters/setters keep
   userProfile and ghToken alive across refreshes. Loaded early, before any
   module that reads NX. */
'use strict';

const NX = {
  allProjects:          [],
  filtered:             [],
  activeTeam:           'all',
  activeStatus:         'all',
  activeOwner:          'all',
  supabaseUser:         null,
  ghCache:              {},
  currentDetailProject: null,
  selectedLangs:        [],  // [{lang, pct}]
  addTeam:              '',
  addStatus:            'active',
  fetchTimeout:         null,
  sugFocusIdx:          -1,
  activeHealth:         'all',
  _pwMode:              false,
  _realtimeSetup:       false,
  _booted:              false,

  /* localStorage-backed so state survives page refresh */
  get userProfile() {
    return JSON.parse(localStorage.getItem('nexus_profile') || 'null');
  },
  set userProfile(v) {
    if (v) localStorage.setItem('nexus_profile', JSON.stringify(v));
    else   localStorage.removeItem('nexus_profile');
  },
  get ghToken() {
    return localStorage.getItem('nexus_gh_token') || '';
  },
  set ghToken(v) {
    if (v) localStorage.setItem('nexus_gh_token', v);
    else   localStorage.removeItem('nexus_gh_token');
  },

  /* ── Tiny pub/sub: views subscribe(); a data change calls emit() ────────── */
  _subs: [],
  subscribe(fn) { this._subs.push(fn); },
  emit() {
    this._subs.forEach(fn => {
      try { fn(); } catch (e) { console.error('[nexus store] subscriber error:', e); }
    });
  },
};
