/* ── markdown.js — safe README renderer + smart section reorder ──────────── */
'use strict';

/*
 * reorderReadme(md) — splits a README into { intro, body } where:
 *   intro = text before the first heading → shown as a "what is this?" callout
 *   body  = h1/h2/h3 sections sorted so purpose-signalling headings come first
 *           (focus, about, overview, purpose, summary, description, goal…)
 *           followed by everything else in original order.
 */
function reorderReadme(md) {
  if (!md) return { intro: '', body: '' };

  let intro = '';
  let rest  = md;

  /* Strategy 1: text before the very first heading */
  const firstHd = md.search(/^#{1,3}\s/m);
  if (firstHd > 0) {
    intro = md.slice(0, firstHd).trim();
    rest  = md.slice(firstHd);
  }

  /* Strategy 2: README opens with a h1 title then body text before first h2 —
     grab that body text as the intro (common pattern: # ProjectName\n\ndesc\n\n## Section) */
  if (!intro) {
    const h1 = md.match(/^#\s+.+$/m);
    const h2pos = md.search(/^#{2,3}\s/m);
    if (h1 && h2pos > h1.index) {
      const afterH1 = md.indexOf('\n', h1.index) + 1;
      const between = md.slice(afterH1, h2pos).trim();
      if (between) {
        intro = between;
        rest  = md.slice(h2pos);
      }
    }
  }

  /* Split at each h2/h3 boundary (skip h1 title — already handled above) */
  const breaks = [];
  const re = /^#{2,3}\s+.+$/gm;
  let match;
  while ((match = re.exec(rest)) !== null) breaks.push(match.index);

  if (!breaks.length) return { intro, body: rest.trim() };

  const PRIORITY =
    /\b(focus|about|overview|purpose|what[\s_-]|summary|description|goal|mission|tl.?dr)\b/i;

  const sections = breaks.map((start, i) => {
    const end     = i + 1 < breaks.length ? breaks[i + 1] : rest.length;
    const content = rest.slice(start, end).trimEnd();
    const hdEnd   = rest.indexOf('\n', start);
    const hdLine  = rest.slice(start, hdEnd > -1 ? hdEnd : rest.length);
    return { content, priority: PRIORITY.test(hdLine) };
  });

  const sorted = [
    ...sections.filter(s => s.priority),
    ...sections.filter(s => !s.priority),
  ];

  return { intro, body: sorted.map(s => s.content).join('\n\n') };
}

/*
 * renderMd(raw) — converts a markdown string to sanitised HTML.
 * Security: escHtml() is called first so no raw user content ever reaches
 * innerHTML directly. Only whitelisted structural tags are injected by this
 * function itself.
 */
function renderMd(raw) {
  if (!raw) return '';

  /* 1. HTML-escape everything first — no user content ever reaches DOM raw */
  let s = escHtml(raw);

  /* 2. Protect fenced code blocks with placeholders before other transforms */
  const codeBlocks = [];
  s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(code.replace(/\n$/, ''));
    return `\x00CODE${i}\x00`;
  });

  /* 3. Inline code */
  s = s.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');

  /* 4. Headings — map h1→h2 down so they don't overpower the panel title */
  s = s.replace(/^######\s+(.+)$/gm, '<div class="md-h5">$1</div>');
  s = s.replace(/^#####\s+(.+)$/gm,  '<div class="md-h5">$1</div>');
  s = s.replace(/^####\s+(.+)$/gm,   '<div class="md-h4">$1</div>');
  s = s.replace(/^###\s+(.+)$/gm,    '<div class="md-h3">$1</div>');
  s = s.replace(/^##\s+(.+)$/gm,     '<div class="md-h2">$1</div>');
  s = s.replace(/^#\s+(.+)$/gm,      '<div class="md-h2">$1</div>');

  /* 5. Bold + italic */
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/___([^_\n]+)___/g,        '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g,      '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g,          '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g,          '<em>$1</em>');
  s = s.replace(/_([^_\n]+)_/g,            '<em>$1</em>');

  /* 6. Images — strip src, show alt text only */
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) =>
    alt ? `<span class="md-img-alt">[ ${alt} ]</span>` : '');

  /* 7. Links — show text, render as styled span (no external href in preview) */
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g,
    '<span class="md-link">$1</span>');

  /* 8. Horizontal rules */
  s = s.replace(/^[-*_]{3,}\s*$/gm, '<hr class="md-hr">');

  /* 9. Blockquotes */
  s = s.replace(/^&gt;\s+(.+)$/gm, '<div class="md-blockquote">$1</div>');

  /* 10. Lists — unordered then ordered */
  s = s.replace(/((?:^[ \t]*[-*+] .+$\n?)+)/gm, block => {
    const items = block.replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>');
    return `<ul class="md-ul">${items.trim()}</ul>`;
  });
  s = s.replace(/((?:^[ \t]*\d+\. .+$\n?)+)/gm, block => {
    const items = block.replace(/^[ \t]*\d+\. (.+)$/gm, '<li>$1</li>');
    return `<ol class="md-ol">${items.trim()}</ol>`;
  });

  /* 11. Paragraphs — split on blank lines, wrap bare text blocks */
  s = s.split(/\n\n+/).map(block => {
    block = block.trim();
    if (!block) return '';
    /* Already-block elements don't get wrapped */
    if (/^<(div|ul|ol|hr|pre|\x00)/.test(block)) return block;
    /* Single newlines within a para become line breaks */
    return `<p class="md-p">${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  /* 12. Restore code blocks */
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) =>
    `<pre class="md-pre"><code>${codeBlocks[+i]}</code></pre>`);

  return s;
}
