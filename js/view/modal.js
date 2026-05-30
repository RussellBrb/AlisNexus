/* ── modal.js — add-project modal, GitHub preview, language tag selector ──── */
'use strict';

let _currentFetchedGH = null;

/* ── Modal open / close ──────────────────────────────────────────────────── */
function openAddProject() {
  resetAddModal();
  el('add-modal').classList.add('open');
  setTimeout(() => el('url-input').focus(), 300);
}

function closeAddProject() {
  el('add-modal').classList.remove('open');
  resetAddModal();
}

function resetAddModal() {
  el('url-input').value               = '';
  el('url-zone').className            = 'url-zone';
  el('fetch-status').style.display    = 'none';
  el('preview-section').style.display = 'none';
  el('btn-publish').disabled          = true;
  el('pf-name-input').value           = '';
  el('pf-oneliner-input').value       = '';
  el('pf-desc-input').value           = '';
  el('pf-tags-input').value           = '';
  el('pf-deploy-input').value         = '';
  _currentFetchedGH                  = null;
  NX.selectedLangs                   = [];
  renderLangTags();

  /* Clear selectors */
  qsa('#team-sel .sel-opt, #status-sel .sel-opt').forEach(e => {
    e.classList.remove('active');
    e.style.background = e.style.borderColor = e.style.color = '';
  });

  /* Pre-select user's team */
  const profile = NX.userProfile;
  if (profile) qsa('#team-sel .sel-opt').forEach(e => { if (e.dataset.val === profile.team) selTeam(e); });

  /* Default status → active */
  qsa('#status-sel .sel-opt').forEach(e => { if (e.dataset.val === 'active') selStatus(e); });
}

/* ── Team / status selectors ─────────────────────────────────────────────── */
function selTeam(elOpt) {
  qsa('#team-sel .sel-opt').forEach(e => {
    e.classList.remove('active'); e.style.background = e.style.borderColor = e.style.color = '';
  });
  elOpt.classList.add('active');
  const col = TEAM_COLORS[elOpt.dataset.val] || 'var(--accent)';
  elOpt.style.background = col + '22';
  elOpt.style.borderColor = col;
  elOpt.style.color = col;
  NX.addTeam = elOpt.dataset.val;
}

function selStatus(elOpt) {
  qsa('#status-sel .sel-opt').forEach(e => {
    e.classList.remove('active'); e.style.background = e.style.borderColor = e.style.color = '';
  });
  elOpt.classList.add('active');
  const cols = { active: 'var(--active)', planning: 'var(--planning)', paused: 'var(--t3)' };
  const col  = cols[elOpt.dataset.val] || 'var(--accent)';
  elOpt.style.background = col + '22';
  elOpt.style.borderColor = col;
  elOpt.style.color = col;
  NX.addStatus = elOpt.dataset.val;
}

/* ── Language tag selector ───────────────────────────────────────────────── */
function getLangDotColor(lang) { return LANG_COLORS[lang] || '#6b7280'; }

function renderLangTags() {
  const wrap = el('lang-tags');
  if (!wrap) return;
  wrap.innerHTML = NX.selectedLangs.map((l, i) => `
    <div class="lang-pill">
      <span class="lang-dot" style="background:${getLangDotColor(l.lang)}"></span>
      <span>${escHtml(l.lang)}</span>
      ${l.pct ? `<span class="lang-pct">${l.pct}%</span>` : ''}
      <button class="lang-remove" onclick="removeLang(${i})">×</button>
    </div>`).join('');
}

function removeLang(i) { NX.selectedLangs.splice(i, 1); renderLangTags(); }

function addLang(lang, pct) {
  if (NX.selectedLangs.find(l => l.lang.toLowerCase() === lang.toLowerCase())) return;
  NX.selectedLangs.push({ lang, pct: pct || 0 });
  renderLangTags();
  el('lang-search').value = '';
  hideLangSuggestions();
}

function hideLangSuggestions() {
  const s = el('lang-suggestions');
  if (s) { s.classList.remove('show'); s.innerHTML = ''; }
  NX.sugFocusIdx = -1;
}

function showLangSuggestions(query) {
  const box = el('lang-suggestions');
  if (!box) return;
  const q       = query.toLowerCase();
  const matches = LANG_LIST
    .filter(l => l.toLowerCase().includes(q) && !NX.selectedLangs.find(s => s.lang.toLowerCase() === l.toLowerCase()))
    .slice(0, 8);
  if (!matches.length) { hideLangSuggestions(); return; }
  box.innerHTML = matches.map(l => `
    <div class="lang-sug-item" onclick="addLang(${JSON.stringify(l)}, 0)">
      <span class="sug-dot" style="background:${getLangDotColor(l)}"></span>
      <span>${escHtml(l)}</span>
    </div>`).join('');
  box.classList.add('show');
  NX.sugFocusIdx = -1;
}

/* ── Lang search keyboard / click wiring (called from app.js on boot) ─────── */
function initLangInput() {
  const input = el('lang-search');
  if (!input) return;

  input.addEventListener('input', function () {
    const q = this.value.trim();
    if (q.length > 0) showLangSuggestions(q); else hideLangSuggestions();
  });

  input.addEventListener('keydown', function (e) {
    const items = qsa('.lang-sug-item');
    if (e.key === 'ArrowDown') {
      NX.sugFocusIdx = Math.min(NX.sugFocusIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('focused', i === NX.sugFocusIdx));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      NX.sugFocusIdx = Math.max(NX.sugFocusIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('focused', i === NX.sugFocusIdx));
      e.preventDefault();
    } else if (e.key === 'Enter' && NX.sugFocusIdx >= 0 && items[NX.sugFocusIdx]) {
      items[NX.sugFocusIdx].click(); e.preventDefault();
    } else if (e.key === 'Enter' && this.value.trim()) {
      addLang(this.value.trim(), 0); e.preventDefault();
    } else if (e.key === 'Escape') {
      hideLangSuggestions();
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.lang-tag-wrap')) hideLangSuggestions();
  });
}

/* ── GitHub URL → preview ────────────────────────────────────────────────── */
function initUrlInput() {
  /* Enable publish button whenever the project name field has a value */
  el('pf-name-input').addEventListener('input', function () {
    el('btn-publish').disabled = !this.value.trim();
  });

  el('url-input').addEventListener('input', function () {
    clearTimeout(NX.fetchTimeout);
    const val = this.value.trim();
    if (!val) {
      el('url-zone').className = 'url-zone';
      el('fetch-status').style.display = 'none';
      return;
    }
    const gh = parseGHUrl(val);
    if (!gh) return;
    NX.fetchTimeout = setTimeout(() => doFetchPreview(gh), 600);
  });
}

async function doFetchPreview(gh) {
  const zone   = el('url-zone');
  const status = el('fetch-status');
  zone.className = 'url-zone fetching';
  status.style.display = 'flex';
  status.innerHTML = '<div class="fetch-spinner"></div><span class="fetch-loading">Fetching from GitHub…</span>';

  const data = await fetchRepoData(gh.owner, gh.repo);

  if (!data || data._private || data._rateLimit) {
    zone.className = 'url-zone';
    if (data?._private) {
      status.innerHTML = `<span class="gh-private">🔒 Private repo — <a href="#" onclick="event.preventDefault();el('token-dialog').classList.add('open')" style="color:var(--accent-l);text-decoration:underline">add GitHub token</a></span>`;
    } else if (data?._rateLimit) {
      status.innerHTML = `<span class="fetch-err">Rate limited — <a href="#" onclick="event.preventDefault();el('token-dialog').classList.add('open')" style="color:var(--accent-l);text-decoration:underline">add GitHub token</a></span>`;
    } else {
      status.innerHTML = '<span class="fetch-err">Could not find that repo — check the URL</span>';
    }
    showPreviewFields({
      name: gh.repo.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      one_liner: '', description: '', language: '', tags: '',
    });
    return;
  }

  zone.className = 'url-zone done';
  status.innerHTML = '<span class="fetch-ok">✓ Loaded from GitHub</span>';
  _currentFetchedGH = data;

  const name = gh.repo.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tags = [...(data.topics || []), data.language].filter(Boolean).join(',');
  showPreviewFields({
    name,
    one_liner:   data.description || '',
    description: data.description || '',
    language:    data.language    || '',
    languages:   data.languages   || [],
    tags,
  });
  el('btn-publish').disabled = false;
}

function showPreviewFields(vals) {
  el('preview-section').style.display  = 'block';
  el('pf-name-input').value     = vals.name        || '';
  el('pf-oneliner-input').value = vals.one_liner   || '';
  el('pf-desc-input').value     = vals.description || '';

  NX.selectedLangs = (vals.languages || []).map(l => ({ lang: l.lang, pct: l.pct }));
  if (!NX.selectedLangs.length && vals.language) NX.selectedLangs = [{ lang: vals.language, pct: 0 }];
  renderLangTags();

  el('pf-tags-input').value = vals.tags || '';

  /* Stagger-animate fields in */
  qsa('.preview-field').forEach((f, i) => {
    f.style.opacity = '0'; f.style.transform = 'translateY(6px)';
    setTimeout(() => { f.style.opacity = '1'; f.style.transform = 'none'; }, i * 80);
  });
  /* Enable publish only if the name field has a value — handled by caller on success,
     or by the name input listener below for the manual-fill path */
}

/* ── Publish ─────────────────────────────────────────────────────────────── */
async function publishProject() {
  const name       = el('pf-name-input').value.trim();
  const github_url = el('url-input').value.trim();
  if (!name) return;

  const btn = el('btn-publish');
  btn.disabled = true; btn.textContent = 'Saving…';

  const profile = NX.userProfile;
  const today   = new Date().toISOString().slice(0, 10);
  const row = {
    created_by:    NX.supabaseUser?.id || null,
    name,
    owner:         profile?.name || '',
    team:          NX.addTeam,
    status:        NX.addStatus,
    one_liner:     el('pf-oneliner-input').value.trim(),
    description:   el('pf-desc-input').value.trim(),
    tech_stack:    NX.selectedLangs.map(l => l.lang).join(','),
    tags:          el('pf-tags-input').value.trim(),
    github_url,
    deploy_url:    safeUrl(el('pf-deploy-input').value.trim()).replace(/^#$/, ''),
    last_updated:  today,
    latest_update: 'Added to Nexus',
    update_log:    `${today} note: Added to Nexus`,
    domain: '',
    client: '',
  };

  const { error } = await _sb.from('projects').insert([row]);
  btn.textContent = 'Add to Nexus'; btn.disabled = false;
  if (error) { alert('Could not save project: ' + error.message); return; }
  closeAddProject();
  loadAndRender();
}
