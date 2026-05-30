/* ── config.js — constants, shared state, Supabase client, utilities ──────── */
'use strict';

/* ── Supabase credentials (anon/public key — safe to expose) ─────────────── */
const SUPA_URL = 'https://ukncfwubvmcnezgxqrsb.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbmNmd3Vidm1jbmV6Z3hxcnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjUwMDgsImV4cCI6MjA5NTA0MTAwOH0.9jQWdWOQ6AvEU7osMnYdaf1Q4Xftn6DQU3XoPYDMvvY';
const ALLOWED_DOMAINS = ['go-alis.com', 'medtelligent.com'];

/* ── Theme maps ──────────────────────────────────────────────────────────── */
const TEAM_COLORS = {
  'engineering':      'var(--eng)',
  'onboarding':       'var(--onb)',
  'customer success': 'var(--cs)',
  'sales':            'var(--sal)',
};
const TEAM_LABELS = {
  'engineering':      'Engineering',
  'onboarding':       'Onboarding',
  'customer success': 'Customer Success',
  'sales':            'Sales',
};
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5',
  Ruby: '#701516',       Go: '#00add8',         Rust: '#dea584',
  HTML: '#e34c26',       CSS: '#563d7c',        Shell: '#89e051',
  Java: '#b07219',
};
const LANG_LIST = [
  'JavaScript','TypeScript','Python','Ruby','Go','Rust','HTML','CSS','Shell',
  'Java','C','C++','C#','Swift','Kotlin','PHP','Scala','R','Dart','Elixir',
  'Haskell','Lua','MATLAB','Perl','PowerShell','Batchfile','Vue','Sass',
  'SCSS','Makefile','Dockerfile','Jupyter Notebook',
];
const STOPWORDS = new Set([
  'the','a','an','is','it','in','on','at','to','for','of','and','or','but',
  'with','has','had','have','was','are','be','been','will','would','could',
  'should','may','might','this','that','from','into','about','after','before',
  'through','during',
]);

/* The NX shared mutable store now lives in js/core/state.js (loaded early). */

/* The Supabase client (_sb) now lives in js/io/supabase.js (loaded after config). */

/* ── DOM utilities ───────────────────────────────────────────────────────── */
function el(id)        { return document.getElementById(id); }
function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }

/* escHtml() and safeUrl() now live in js/core/format.js (pure, loaded first). */
