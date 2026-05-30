/* ── io/supabase.js — Supabase client (gateway to data + auth) ───────────── */
/* Implicit flow is required for magic links on static hosting. Uses the public
   anon key from config.js (safe to expose); the service-role key never appears
   client-side. Loaded right after config.js, before any module that calls _sb. */
'use strict';

const _sb = supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    flowType:           'implicit',  // hash-token magic links — works on static hosting
    detectSessionInUrl: true,        // parse #access_token on magic-link return
    persistSession:     true,        // keep session across refreshes
    autoRefreshToken:   true,
  },
});
