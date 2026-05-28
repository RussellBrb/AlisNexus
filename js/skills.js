/* ── skills.js — skill & expertise computation + matrix view ─────────────── */
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   SKILL COMPUTATION
   Sources (weighted):
     • GitHub language breakdown  — highest signal (actual code)
     • tech_stack field            — medium signal (declared stack)
     • GitHub topics + tags        — lower signal (domain labels)
   Weights:
     active project   × 3   |  planning × 2  |  paused × 1
     Hot/Steady health × 1.4 |  Slowing × 1.0 |  Stalled × 0.7
═══════════════════════════════════════════════════════════════════════════ */
function computePersonSkills(ownerName) {
  const projects = NX.allProjects.filter(p => p.owner === ownerName);
  if (!projects.length) return { languages: [], technologies: [], domains: [], total: 0 };

  const langMap   = {};
  const techMap   = {};
  const domainMap = {};

  projects.forEach(p => {
    const sW = { active: 3, planning: 2, paused: 1 }[p.status] || 1;
    const hS = computeHealth(p).score;
    const hW = hS >= 3 ? 1.4 : hS >= 1 ? 1.0 : 0.7;
    const w  = sW * hW;

    /* GitHub language percentages */
    const langs = p._github?.languages;
    if (langs?.length) {
      langs.forEach(({ lang, pct }) => {
        langMap[lang] = langMap[lang] || { score: 0, projects: new Set() };
        langMap[lang].score += (pct / 100) * w * 10;
        langMap[lang].projects.add(p.name);
      });
    } else if (p._github?.language) {
      const l = p._github.language;
      langMap[l] = langMap[l] || { score: 0, projects: new Set() };
      langMap[l].score += w * 10;
      langMap[l].projects.add(p.name);
    }

    /* Declared tech stack */
    (p.tech_stack || '').split(',').map(t => t.trim()).filter(Boolean).forEach(tech => {
      techMap[tech] = techMap[tech] || { score: 0, projects: new Set() };
      techMap[tech].score += w * 8;
      techMap[tech].projects.add(p.name);
    });

    /* Tags + GitHub topics → domains */
    const domains = [
      ...(p.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      ...(p._github?.topics || []),
    ];
    domains.forEach(d => {
      domainMap[d] = domainMap[d] || { score: 0, projects: new Set() };
      domainMap[d].score += w * 4;
      domainMap[d].projects.add(p.name);
    });
  });

  const toArr = map => Object.entries(map)
    .map(([name, { score, projects }]) => ({
      name,
      score:    Math.round(score * 10) / 10,
      projects: [...projects],
    }))
    .sort((a, b) => b.score - a.score);

  return {
    languages:    toArr(langMap),
    technologies: toArr(techMap),
    domains:      toArr(domainMap),
    total:        projects.length,
  };
}

/* ── Skill profile HTML (injected into profile panel) ───────────────────── */
function personSkillsHtml(ownerName) {
  const s = computePersonSkills(ownerName);
  if (!s.languages.length && !s.technologies.length && !s.domains.length) {
    return `<div class="prof-section">
      <div class="prof-section-label">Skills &amp; Expertise</div>
      <p style="color:var(--t3);font-size:13px;line-height:1.6">
        No skill data yet — add GitHub URLs and tech stack fields to this person's projects.
      </p></div>`;
  }

  const maxL = s.languages[0]?.score    || 1;
  const maxT = s.technologies[0]?.score || 1;

  const langBars = s.languages.slice(0, 7).map(l => {
    const pct = Math.max(Math.round(l.score / maxL * 100), 4);
    const col = LANG_COLORS[l.name] || 'var(--accent-l)';
    return `<div class="sk-bar-row" title="${l.projects.join(', ')}">
      <div class="sk-bar-name">
        <span class="lang-dot" style="background:${col}"></span>
        ${escHtml(l.name)}
      </div>
      <div class="sk-bar-track">
        <div class="sk-bar-fill" style="width:${pct}%;background:${col}"></div>
      </div>
      <span class="sk-bar-pct">${pct}%</span>
    </div>`;
  }).join('');

  const techChips = s.technologies.slice(0, 10).map(t =>
    `<span class="sk-tech-chip" title="${t.projects.join(', ')}">
      ${escHtml(t.name)}
      <span class="sk-chip-count">${t.projects.length}</span>
    </span>`
  ).join('');

  const domChips = s.domains.slice(0, 8).map(d =>
    `<span class="sk-domain-chip">${escHtml(d.name)}</span>`
  ).join('');

  return `
    <div class="prof-section">
      <div class="prof-section-label">Skills &amp; Expertise</div>

      ${s.languages.length ? `
        <div class="sk-sub-label">Languages</div>
        <div class="sk-bars">${langBars}</div>` : ''}

      ${s.technologies.length ? `
        <div class="sk-sub-label" style="margin-top:16px">Tech Stack</div>
        <div class="sk-chips">${techChips}</div>` : ''}

      ${s.domains.length ? `
        <div class="sk-sub-label" style="margin-top:14px">Domains</div>
        <div class="sk-chips">${domChips}</div>` : ''}
    </div>`;
}

/* ── Top-3 skill badges for person cards in the roster ──────────────────── */
function personTopSkills(ownerName) {
  const s  = computePersonSkills(ownerName);
  const top = [
    ...s.languages.slice(0, 2).map(l => ({ name: l.name, color: LANG_COLORS[l.name] || 'var(--accent-l)' })),
    ...s.technologies.slice(0, 1).map(t => ({ name: t.name, color: 'var(--t3)' })),
  ].slice(0, 3);
  return top.map(sk =>
    `<span class="person-skill-tag" style="border-color:${sk.color}20;color:${sk.color}">
      ${escHtml(sk.name)}
    </span>`
  ).join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKILL MATRIX VIEW
═══════════════════════════════════════════════════════════════════════════ */
function renderSkillMatrix() {
  const wrap = el('skill-matrix-wrap');
  if (!wrap) return;

  const owners = [...new Set(NX.allProjects.map(p => p.owner).filter(Boolean))];
  if (!owners.length) {
    wrap.innerHTML = '<p style="color:var(--t3);font-size:13px;padding:20px 0">No team members yet.</p>';
    return;
  }

  /* Gather all skills per person */
  const personSkills = {};
  owners.forEach(n => { personSkills[n] = computePersonSkills(n); });

  /* Collect top skills across team (deduplicated, ranked by team-wide presence) */
  const skillCount = {};
  owners.forEach(n => {
    [...personSkills[n].languages.slice(0, 6), ...personSkills[n].technologies.slice(0, 4)]
      .forEach(s => { skillCount[s.name] = (skillCount[s.name] || 0) + s.score; });
  });
  const topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name);

  if (!topSkills.length) {
    wrap.innerHTML = '<p style="color:var(--t3);font-size:13px;padding:20px 0">Add GitHub URLs or tech stack to projects to populate the matrix.</p>';
    return;
  }

  /* Normalise: max score per skill across all people */
  const maxPerSkill = {};
  topSkills.forEach(skill => {
    maxPerSkill[skill] = Math.max(1, ...owners.map(n => {
      const all = [...personSkills[n].languages, ...personSkills[n].technologies];
      return all.find(s => s.name === skill)?.score || 0;
    }));
  });

  /* Cell renderer */
  function matrixCell(ownerName, skill) {
    const all   = [...personSkills[ownerName].languages, ...personSkills[ownerName].technologies];
    const entry = all.find(s => s.name === skill);
    if (!entry || !entry.score) {
      return `<div class="mx-cell mx-cell--empty">
        <div class="mx-dot" style="opacity:.07"></div>
      </div>`;
    }
    const ratio   = Math.min(entry.score / maxPerSkill[skill], 1);
    const opacity = 0.15 + ratio * 0.85;
    const scale   = 0.3 + ratio * 0.7;
    const col     = LANG_COLORS[skill] || 'var(--accent-l)';
    return `<div class="mx-cell" title="${escHtml(ownerName)}: ${escHtml(skill)} · ${entry.projects.length} project${entry.projects.length !== 1 ? 's' : ''}">
      <div class="mx-dot" style="transform:scale(${scale.toFixed(2)});opacity:${opacity.toFixed(2)};background:${col}"></div>
    </div>`;
  }

  /* Person column headers */
  const headers = `<div class="mx-row mx-header-row">
    <div class="mx-skill-col"></div>
    ${owners.map(n => {
      const team = NX.allProjects.find(p => p.owner === n)?.team || '';
      const col  = teamColor(team);
      return `<div class="mx-person-col" onclick="closePeopleRoster();openProfile('${escHtml(n)}')">
        <div class="mx-av" style="background:${col}20;color:${col}">${ownerInitials(n)}</div>
        <div class="mx-pname">${escHtml(n.split(' ')[0])}</div>
      </div>`;
    }).join('')}
  </div>`;

  /* Skill rows */
  const rows = topSkills.map(skill => {
    const col = LANG_COLORS[skill] || 'var(--t3)';
    return `<div class="mx-row">
      <div class="mx-skill-col">
        ${LANG_COLORS[skill]
          ? `<span class="lang-dot" style="background:${col}"></span>`
          : `<span class="mx-tech-dot"></span>`}
        <span class="mx-skill-name">${escHtml(skill)}</span>
      </div>
      ${owners.map(n => matrixCell(n, skill)).join('')}
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="skill-matrix">${headers}${rows}</div>`;
}
