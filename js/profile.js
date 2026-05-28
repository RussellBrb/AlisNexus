/* ── profile.js — user profile panel + team people roster ───────────────── */
'use strict';

/* ── Overlay close dispatcher ────────────────────────────────────────────── */
function closeOverlay() {
  if (el('profile-panel')?.classList.contains('open')) { closeProfile(); return; }
  if (el('people-modal')?.classList.contains('open'))  { closePeopleRoster(); return; }
  closeDetail();
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILE PANEL — own profile (editable) + others (read-only)
═══════════════════════════════════════════════════════════════════════════ */
function openProfile(ownerName) {
  const myName  = NX.userProfile?.name || '';
  const isMe    = !ownerName || ownerName === myName;
  const name    = isMe ? myName : ownerName;
  const team    = isMe
    ? (NX.userProfile?.team || '')
    : (NX.allProjects.find(p => p.owner === ownerName)?.team || '');
  const role    = isMe ? (NX.userProfile?.role || '') : '';
  const bio     = isMe ? (NX.userProfile?.bio  || '') : '';
  const col     = teamColor(team);
  const initials = ownerInitials(name || '?');
  const projects = NX.allProjects.filter(p => p.owner === name);
  const active   = projects.filter(p => p.status === 'active').length;

  /* ── Header ── */
  const header = `
    <div class="prof-header">
      <div class="prof-av" style="background:${col}20;color:${col};border:2px solid ${col}35">
        ${escHtml(initials)}
      </div>
      <div class="prof-header-info">
        <div class="prof-name-disp">${escHtml(name || 'Unknown')}</div>
        ${role ? `<div class="prof-role-disp">${escHtml(role)}</div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
          ${team ? `<span class="team-badge" style="background:${col}18;color:${col}">${escHtml(teamLabel(team))}</span>` : ''}
          ${isMe && NX.supabaseUser?.email ? `<span class="prof-email-chip">${escHtml(NX.supabaseUser.email)}</span>` : ''}
        </div>
        ${bio ? `<div class="prof-bio-disp">${escHtml(bio)}</div>` : ''}
      </div>
    </div>
    <div class="prof-stats-row">
      <div class="prof-stat"><div class="prof-stat-val">${projects.length}</div><div class="prof-stat-lbl">Projects</div></div>
      <div class="prof-stat"><div class="prof-stat-val" style="color:var(--active)">${active}</div><div class="prof-stat-lbl">Active</div></div>
      <div class="prof-stat"><div class="prof-stat-val">${projects.filter(p=>p.status==='planning').length}</div><div class="prof-stat-lbl">Planning</div></div>
    </div>`;

  /* ── Edit form (own profile only) ── */
  const teamOpts = Object.entries(TEAM_LABELS)
    .map(([k, v]) => `<option value="${k}" ${team === k ? 'selected' : ''}>${escHtml(v)}</option>`)
    .join('');

  const editSection = isMe ? `
    <div class="prof-section">
      <div class="prof-section-label">Edit profile</div>
      <div class="prof-form">
        <div class="prof-field">
          <label class="prof-label">Display name</label>
          <input class="prof-input" id="prof-name-inp" value="${escHtml(name)}" placeholder="Your name">
        </div>
        <div class="prof-field">
          <label class="prof-label">Role / title</label>
          <input class="prof-input" id="prof-role-inp" value="${escHtml(role)}" placeholder="e.g. Software Engineer">
        </div>
        <div class="prof-field">
          <label class="prof-label">Bio</label>
          <input class="prof-input" id="prof-bio-inp" value="${escHtml(bio)}" placeholder="What do you work on?">
        </div>
        <div class="prof-field">
          <label class="prof-label">Team</label>
          <select class="prof-input" id="prof-team-sel">
            <option value="">No team</option>${teamOpts}
          </select>
        </div>
      </div>
      <div class="prof-actions">
        <button class="prof-btn-primary" onclick="saveProfile()">Save profile</button>
        <span class="prof-status" id="prof-save-status"></span>
      </div>
    </div>

    <div class="prof-section">
      <div class="prof-section-label">Password</div>
      <div class="prof-form">
        <div class="prof-field">
          <label class="prof-label">New password</label>
          <input class="prof-input" id="prof-pw1" type="password" placeholder="Minimum 8 characters">
        </div>
        <div class="prof-field">
          <label class="prof-label">Confirm password</label>
          <input class="prof-input" id="prof-pw2" type="password" placeholder="Repeat new password">
        </div>
      </div>
      <div class="prof-actions">
        <button class="prof-btn-primary" onclick="changePassword()">Update password</button>
        <button class="prof-btn-ghost" onclick="sendPasswordReset()">Email reset link</button>
        <span class="prof-status" id="prof-pw-status"></span>
      </div>
    </div>` : '';

  /* ── Projects list ── */
  const projSection = projects.length ? `
    <div class="prof-section">
      <div class="prof-section-label">Projects</div>
      <div class="prof-proj-list">
        ${projects.map(p => {
          const sc  = (p.status || 'paused').toLowerCase();
          const ptc = teamColor(p.team);
          return `<div class="prof-proj-row" onclick="closeProfile();openDetail('${p._id}')">
            <span class="status-dot ${sc}" style="flex-shrink:0;margin-top:1px"></span>
            <span class="prof-proj-name">${escHtml(p.name)}</span>
            <span class="prof-proj-sub">${escHtml(p.one_liner || '')}</span>
            ${p.team ? `<span class="team-badge" style="background:${ptc}18;color:${ptc};flex-shrink:0">${escHtml(teamLabel(p.team))}</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : `<div class="prof-section"><span style="color:var(--t3);font-size:13px">No projects yet.</span></div>`;

  el('prof-body').innerHTML = header + editSection + projSection;
  el('profile-panel').classList.add('open');
  el('overlay').classList.add('open');
}

function closeProfile() {
  el('profile-panel').classList.remove('open');
  el('overlay').classList.remove('open');
}

/* ── Save profile to Supabase user metadata ────────────────────────────── */
async function saveProfile() {
  const name   = el('prof-name-inp').value.trim();
  const role   = el('prof-role-inp').value.trim();
  const bio    = el('prof-bio-inp').value.trim();
  const team   = el('prof-team-sel').value;
  const status = el('prof-save-status');

  if (!name) { _profStatus(status, 'Name is required.', 'error'); return; }
  _profStatus(status, 'Saving…', 'pending');

  try {
    await _sb.auth.updateUser({ data: { name, role, bio, team } });
    NX.userProfile = { ...(NX.userProfile || {}), name, role, bio, team };
    /* Update avatar initials live */
    const av = el('user-avatar');
    if (av) av.textContent = ownerInitials(name);
    _profStatus(status, 'Saved ✓', 'ok');
  } catch (e) {
    _profStatus(status, e.message || 'Error saving.', 'error');
  }
}

/* ── Change password ─────────────────────────────────────────────────────── */
async function changePassword() {
  const pw1    = el('prof-pw1').value;
  const pw2    = el('prof-pw2').value;
  const status = el('prof-pw-status');

  if (!pw1 || pw1.length < 8) { _profStatus(status, 'Minimum 8 characters.', 'error'); return; }
  if (pw1 !== pw2)             { _profStatus(status, 'Passwords don\'t match.', 'error'); return; }

  _profStatus(status, 'Updating…', 'pending');
  try {
    const { error } = await _sb.auth.updateUser({ password: pw1 });
    if (error) throw error;
    el('prof-pw1').value = '';
    el('prof-pw2').value = '';
    _profStatus(status, 'Password updated ✓', 'ok');
  } catch (e) {
    _profStatus(status, e.message || 'Error updating password.', 'error');
  }
}

/* ── Send password reset email ───────────────────────────────────────────── */
async function sendPasswordReset() {
  const email  = NX.supabaseUser?.email;
  const status = el('prof-pw-status');
  if (!email) { _profStatus(status, 'No email found.', 'error'); return; }

  _profStatus(status, 'Sending…', 'pending');
  try {
    const { error } = await _sb.auth.resetPasswordForEmail(email);
    if (error) throw error;
    _profStatus(status, `Reset link sent to ${email}`, 'ok');
  } catch (e) {
    _profStatus(status, e.message || 'Error sending reset.', 'error');
  }
}

function _profStatus(el, msg, type) {
  el.textContent = msg;
  el.style.color = type === 'ok' ? 'var(--active)' : type === 'error' ? '#f87171' : 'var(--t3)';
  if (type === 'ok') setTimeout(() => { el.textContent = ''; }, 3000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PEOPLE ROSTER — team members grouped by team
═══════════════════════════════════════════════════════════════════════════ */
function openPeopleRoster() {
  const myName = NX.userProfile?.name || '';
  const owners = [...new Set(NX.allProjects.map(p => p.owner).filter(Boolean))];

  if (!owners.length) {
    el('people-body').innerHTML =
      '<p style="color:var(--t3);font-size:13px;padding:24px 20px">No team members yet.</p>';
    el('people-modal').classList.add('open');
    return;
  }

  /* Build person objects */
  const people = owners.map(n => {
    const projs  = NX.allProjects.filter(p => p.owner === n);
    const team   = projs[0]?.team || '';
    const active = projs.filter(p => p.status === 'active').length;
    return { name: n, team, projects: projs, active };
  }).sort((a, b) => a.name.localeCompare(b.name));

  /* Group by team */
  const teamOrder = Object.keys(TEAM_LABELS);
  const teamsUsed = [...new Set(people.map(p => p.team))].sort((a, b) => {
    const ia = teamOrder.indexOf(a), ib = teamOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const html = teamsUsed.map(t => {
    const col     = t ? teamColor(t) : 'var(--t3)';
    const label   = t ? teamLabel(t) : 'No team';
    const members = people.filter(p => p.team === t);

    const cards = members.map(person => {
      const isMe = person.name === myName;
      return `<div class="person-card" onclick="closePeopleRoster();openProfile('${escHtml(person.name)}')">
        <div class="person-av" style="background:${col}20;color:${col}">
          ${escHtml(ownerInitials(person.name))}
        </div>
        <div class="person-info">
          <div class="person-name">${escHtml(person.name)}${isMe ? ' <span class="you-tag">you</span>' : ''}</div>
          <div class="person-meta">
            ${person.projects.length} project${person.projects.length !== 1 ? 's' : ''}
            ${person.active ? `<span style="color:var(--active)"> · ${person.active} active</span>` : ''}
          </div>
        </div>
        <div class="person-proj-dots">
          ${person.projects.slice(0, 5).map(p =>
            `<span class="ppd" style="background:${teamColor(p.team)}" title="${escHtml(p.name)}"></span>`
          ).join('')}
        </div>
      </div>`;
    }).join('');

    return `<div class="people-group">
      <div class="people-group-label" style="color:${col}">
        <span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block"></span>
        ${escHtml(label)}
        <span class="people-group-count">${members.length}</span>
      </div>
      <div class="people-cards">${cards}</div>
    </div>`;
  }).join('');

  el('people-body').innerHTML = html;
  el('people-modal').classList.add('open');
}

function closePeopleRoster() {
  el('people-modal').classList.remove('open');
}
