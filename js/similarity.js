/* ── similarity.js — lightweight text similarity for "Related Projects" ───── */
'use strict';

function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase()
      .split(/[\s,.\-_/()]+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  const inter = new Set([...a].filter(x => b.has(x)));
  return inter.size / (a.size + b.size - inter.size);
}

function computeSimilarity(p, q) {
  const reasons = []; let score = 0;

  const tagsP = new Set((p.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
  const tagsQ = new Set((q.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
  const sharedTags = [...tagsP].filter(t => tagsQ.has(t));
  if (sharedTags.length) {
    score += 0.4 * jaccard(tagsP, tagsQ);
    reasons.push('shared tags: ' + sharedTags.slice(0, 3).join(', '));
  }

  if (p.domain && q.domain && p.domain.toLowerCase() === q.domain.toLowerCase()) {
    score += 0.3;
    reasons.push('same domain: ' + p.domain);
  }

  const sP = new Set((p.tech_stack || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
  const sQ = new Set((q.tech_stack || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
  const sharedStack = [...sP].filter(t => sQ.has(t));
  if (sharedStack.length) {
    score += 0.2 * jaccard(sP, sQ);
    reasons.push('shared tech: ' + sharedStack.slice(0, 2).join(', '));
  }

  const kwP = tokenize((p.description || '') + ' ' + (p.one_liner || ''));
  const kwQ = tokenize((q.description || '') + ' ' + (q.one_liner || ''));
  const kwSim = jaccard(kwP, kwQ);
  if (kwSim > 0.08) score += 0.1 * kwSim;

  return { score: Math.round(score * 100), reasons: reasons.slice(0, 2) };
}

function getSimilar(project, all, limit = 4) {
  return all
    .filter(p => p !== project && p.status !== 'archived')
    .map(p => ({ project: p, ...computeSimilarity(project, p) }))
    .filter(r => r.score > 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
