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
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }
  if (!_validateDomain(email, errEl)) return;

  const btn = el('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const { error } = await _sb.auth.signInWithPassword({ email, password });
  btn.textContent = 'Sign In →'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; }
  /* success handled by onAuthStateChange */
}

async function sendMagicLink() {
  const email = _loginEmail();
  const errEl = el('login-error');
  errEl.style.display = 'none';

  if (!email) { errEl.textContent = 'Please enter your email.'; errEl.style.display = 'block'; return; }
  if (!_validateDomain(email, errEl)) return;

  const btn = el('login-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;
  const { error } = await _sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: 'https://russellbrb.github.io/AlisNexus' },
  });
  if (error) {
    errEl.textContent = error.message; errEl.style.display = 'block';
    btn.textContent = 'Send Magic Link →'; btn.disabled = false;
    return;
  }
  el('login-form').style.display = 'none';
  el('login-sent-email').textContent = email;
  el('login-sent').style.display = 'block';
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
  if (!profile) return;

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

/* ── Boot sequence (runs last after all modules load) ────────────────────── */
function bootAuth() {
  /* Clean up legacy keys from old localStorage-only version */
  localStorage.removeItem('nexus_sheet_url');
  localStorage.removeItem('nexus_local_projects');

  /* Fast path: render profile immediately from localStorage while Supabase loads */
  if (NX.userProfile) initProfile();

  const gate = el('login-gate');

  async function hideGateAndBoot(user) {
    NX.supabaseUser = user;
    gate.classList.add('hide');
    setTimeout(() => { gate.style.display = 'none'; }, 400);

    const meta = user.user_metadata || {};
    if (meta.name && meta.team) {
      NX.userProfile = { name: meta.name, team: meta.team };
    } else if (!NX.userProfile) {
      const nameEl = el('ob-name');
      if (nameEl) nameEl.value = user.email.split('@')[0];
    }

    /* Restore GitHub token from Supabase metadata — works across devices */
    if (meta.gh_token && !NX.ghToken) NX.ghToken = meta.gh_token;

    initProfile();
    if (NX.userProfile) loadAndRender();
  }

  /* Handle magic link clicks and password sign-in via auth state changes */
  _sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) hideGateAndBoot(session.user);
    else if (event === 'SIGNED_OUT') { NX.userProfile = null; location.reload(); }
  });

  /* Check for existing session (returning user, page refresh) */
  _sb.auth.getSession().then(({ data }) => {
    if (data.session) hideGateAndBoot(data.session.user);
  });
}
