/* ── auth.js — login, onboarding, profile, avatar menu, boot ─────────────── */
'use strict';

/* ── Login helpers ───────────────────────────────────────────────────────── */
function togglePasswordMode() {
  NX._pwMode = !NX._pwMode;
  el('pw-section').style.display       = NX._pwMode ? 'block' : 'none';
  el('login-btn').textContent          = NX._pwMode ? 'Sign In →' : 'Send Magic Link →';
  el('toggle-pw-link').textContent     = NX._pwMode ? 'Send magic link instead' : 'Sign in with password instead';
  el('login-error').style.display      = 'none';
}

function handleLogin() { NX._pwMode ? signInWithPassword() : sendMagicLink(); }

function _loginEmail() {
  return (el('login-email').value || '').trim().toLowerCase();
}

function showLoginError(errEl, msg) {
  if (!errEl) return;
  errEl.textContent   = msg;
  errEl.style.display = 'block';
}

function _validateDomain(email, errEl) {
  const domain = email.split('@')[1];
  if (!ALLOWED_DOMAINS.includes(domain)) {
    errEl.textContent   = 'Access is restricted to @go-alis.com and @medtelligent.com emails.';
    errEl.style.display = 'block';
    return false;
  }
  return true;
}

async function signInWithPassword() {
  const email    = _loginEmail();
  const password = el('login-password').value || '';
  const errEl    = el('login-error');
  errEl.style.display = 'none';

  if (!email || !password) {
    showLoginError(errEl, 'Please enter your email and password.');
    return;
  }
  if (!_validateDomain(email, errEl)) return;

  const btn = el('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    console.log('[nexus auth] signInWithPassword →', error ? error.message : 'success', '| session:', !!data?.session);
    if (error) {
      showLoginError(errEl, error.message);
    } else if (!data?.session) {
      /* No session despite no error usually means email confirmation is required */
      showLoginError(errEl, 'Signed in, but no session was returned. The account may need email confirmation in Supabase.');
    } else {
      /* Drive the app directly from the returned session — do NOT rely on the
         onAuthStateChange event, which does not reliably fire for password grants. */
      enterApp(data.session.user);
    }
  } catch (e) {
    console.error('[nexus auth] signInWithPassword threw:', e);
    showLoginError(errEl, 'Could not reach the auth server: ' + (e?.message || e));
  } finally {
    btn.textContent = 'Sign In →'; btn.disabled = false;
  }
}

async function sendMagicLink() {
  const email = _loginEmail();
  const errEl = el('login-error');
  errEl.style.display = 'none';

  if (!email) { showLoginError(errEl, 'Please enter your email.'); return; }
  if (!_validateDomain(email, errEl)) return;

  const btn = el('login-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  /* Return to wherever the app is actually running (local or deployed), minus any hash */
  const redirectTo = window.location.href.split('#')[0];
  try {
    const { error } = await _sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    console.log('[nexus auth] signInWithOtp →', error ? error.message : 'sent', '| redirectTo:', redirectTo);
    if (error) {
      showLoginError(errEl, error.message);
      btn.textContent = 'Send Magic Link →'; btn.disabled = false;
      return;
    }
    el('login-form').style.display = 'none';
    el('login-sent-email').textContent = email;
    el('login-sent').style.display = 'block';
  } catch (e) {
    console.error('[nexus auth] signInWithOtp threw:', e);
    showLoginError(errEl, 'Could not reach the auth server: ' + (e?.message || e));
    btn.textContent = 'Send Magic Link →'; btn.disabled = false;
  }
}

function signOut() {
  _sb.auth.signOut().then(() => { NX.userProfile = null; location.reload(); });
}

/* ── Avatar dropdown menu ────────────────────────────────────────────────── */
function toggleAvatarMenu() {
  const menu = el('avatar-menu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
function closeAvatarMenu() {
  const menu = el('avatar-menu');
  if (menu) menu.style.display = 'none';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#user-avatar') && !e.target.closest('#avatar-menu')) closeAvatarMenu();
});

/* ── Profile init / display ──────────────────────────────────────────────── */
function initProfile() {
  const ob = el('onboard');
  if (NX.userProfile) {
    ob.classList.remove('show');
    ob.classList.add('hide');
    setTimeout(() => { ob.style.display = 'none'; }, 400);
    applyProfile();
  } else {
    ob.style.display = 'flex';
    setTimeout(() => ob.classList.add('show'), 10);
  }
}

function applyProfile() {
  const profile = NX.userProfile;
  if (!profile || !profile.name) return;

  const av       = el('user-avatar');
  const initials = profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const col      = TEAM_COLORS[profile.team] || 'var(--accent)';
  av.textContent       = initials;
  av.style.background  = col + '22';
  av.style.color       = col;
  av.style.borderColor = col + '44';

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  el('greeting').textContent = `${greeting}, ${profile.name.split(' ')[0]}.`;
  el('hero-sub').textContent = "Here's what your team is building.";

  /* Avatar menu info */
  const menuName = el('avatar-menu-name');
  if (menuName) menuName.textContent = profile.name;
  if (NX.supabaseUser) {
    const menuEmail = el('avatar-menu-email');
    if (menuEmail) menuEmail.textContent = NX.supabaseUser.email;
  }

  /* Pre-select user's team in the add-project modal */
  qsa('#team-sel .sel-opt').forEach(e => { if (e.dataset.val === profile.team) selTeam(e); });
}

/* ── Onboarding ──────────────────────────────────────────────────────────── */
function completeOnboard() {
  const nameInput = el('ob-name');
  const name      = (nameInput?.value || '').trim();
  const teamInput = qs('input[name=team]:checked');

  if (!name) {
    if (nameInput) { nameInput.style.borderColor = '#f87171'; nameInput.focus(); }
    return;
  }
  if (!teamInput) {
    const tg = el('ob-teams');
    if (tg) {
      tg.style.outline = '2px solid #f87171'; tg.style.borderRadius = '12px';
      setTimeout(() => { tg.style.outline = ''; }, 1200);
    }
    return;
  }

  NX.userProfile = { name, team: teamInput.value };
  if (NX.supabaseUser) _sb.auth.updateUser({ data: { name, team: teamInput.value } });

  const ob = el('onboard');
  ob.classList.remove('show'); ob.classList.add('hide');
  setTimeout(() => { ob.style.display = 'none'; }, 400);
  applyProfile();
  loadAndRender();
}

/* ── Enter the app once a session exists (single source of truth) ─────────── */
/* Called directly from sign-in success and from getSession/onAuthStateChange.  */
/* Idempotent via NX._booted, so multiple triggers are safe.                    */
function enterApp(user) {
  if (NX._booted || !user) return;
  NX._booted      = true;
  NX.supabaseUser = user;

  const gate = el('login-gate');
  if (gate) {
    gate.classList.add('hide');
    setTimeout(() => { gate.style.display = 'none'; }, 400);
  }

  const meta = user.user_metadata || {};
  if (meta.name && meta.team) {
    NX.userProfile = { name: meta.name, team: meta.team };
  } else if (!NX.userProfile) {
    const nameEl = el('ob-name');
    if (nameEl) nameEl.value = (user.email || '').split('@')[0];
  }

  /* Restore GitHub token from Supabase metadata — works across devices */
  if (meta.gh_token && !NX.ghToken) NX.ghToken = meta.gh_token;

  try { initProfile(); } catch (e) { console.error('[nexus auth] initProfile failed:', e); }
  if (NX.userProfile) loadAndRender();
}

/* ── Boot sequence (runs last after all modules load) ────────────────────── */
function bootAuth() {
  /* Clean up legacy keys from old localStorage-only version */
  localStorage.removeItem('nexus_sheet_url');
  localStorage.removeItem('nexus_local_projects');

  /* ── Auth wiring FIRST — never blocked by optimistic UI work ── */
  /* Backup listener: catches magic-link returns and cross-tab sign-in. The     */
  /* password path calls enterApp() directly since SIGNED_IN may not fire.      */
  _sb.auth.onAuthStateChange((event, session) => {
    console.log('[nexus auth] event:', event, '| session:', !!session);
    if (event === 'SIGNED_IN' && session) {
      setTimeout(() => enterApp(session.user), 0);
    } else if (event === 'SIGNED_OUT') {
      NX.userProfile = null; location.reload();
    }
  });

  /* Check for an existing/returning session (page refresh, magic-link hash) */
  _sb.auth.getSession()
    .then(({ data, error }) => {
      if (error) console.error('[nexus auth] getSession error:', error.message);
      console.log('[nexus auth] getSession → session:', !!data?.session);
      if (data?.session) enterApp(data.session.user);
    })
    .catch(e => console.error('[nexus auth] getSession threw:', e));

  /* Optimistic profile render from localStorage — isolated so a stale/partial   */
  /* value can never throw and break the auth wiring above.                       */
  try {
    if (NX.userProfile) initProfile();
  } catch (e) {
    console.error('[nexus auth] optimistic initProfile failed; clearing stale profile:', e);
    NX.userProfile = null;
  }
}
