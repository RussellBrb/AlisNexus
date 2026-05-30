/* ── core/skills.js — skill & expertise computation (pure domain) ────────── */
/* Derives a person's skills from their projects' GitHub languages, declared
   tech stack, and tags/topics. Reads NX (state) and computeHealth (core).
   The matrix and profile rendering live in js/view/skills-view.js.

   Sources (weighted):
     • GitHub language breakdown  — highest signal (actual code)
     • tech_stack field            — medium signal (declared stack)
     • GitHub topics + tags        — lower signal (domain labels)
   Weights:
     active project   × 3   |  planning × 2  |  paused × 1
     Hot/Steady health × 1.4 |  Slowing × 1.0 |  Quiet × 0.7
*/
'use strict';

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
