/* ── markdown.js — safe README renderer ────────────────────────────────────── */
'use strict';

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
