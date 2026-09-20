// Minimal, XSS-safe markdown -> HTML for assistant replies.
//
// SECURITY: the entire input is HTML-escaped BEFORE any formatting runs, and
// this function only ever emits tags it generates itself (pre/code/strong/em/
// h1-6/ul/li/br). There is NO raw-HTML passthrough and NO link syntax (avoids
// the javascript: href vector). Safe to hand to dangerouslySetInnerHTML.
//
// ponytail: deliberately covers only the markdown LLMs actually emit. Add
// tables/links (with href sanitizing) only if a real need shows up.

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

// Sentinel wrapping extracted code blocks: a control char that never appears in
// model output, so it can't be confused with real text. (A bare digit wrapped
// in spaces used to be mistaken for a block index and corrupted the render.)
const MARK = String.fromCharCode(0);
const MARK_RE = new RegExp(MARK + "(\\d+)" + MARK, "g");

export function renderMarkdown(src) {
  const text = String(src ?? "");

  // 1. Pull fenced code blocks out first so inline rules don't touch them.
  //    Each gets a header bar with the language and a copy button (wired up by
  //    a delegated click handler in MessageList - it reads the <pre> text).
  const blocks = [];
  let out = text.replace(/```([^\n]*)\n?([\s\S]*?)```/g, (_, info, code) => {
    const i = blocks.length;
    const lang = escapeHtml((info.trim().split(/\s+/)[0] || "text").toLowerCase());
    blocks.push(
      `<div class="md-cb"><div class="md-cb-bar">` +
        `<span class="md-cb-lang">${lang}</span>` +
        `<button type="button" class="md-copy">copy</button></div>` +
        `<pre class="md-pre"><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>` +
        `</div>`,
    );
    return MARK + i + MARK;
  });

  // 2. Escape everything else.
  out = escapeHtml(out);

  // 3. Inline formatting on the escaped text.
  out = out.replace(/`([^`\n]+)`/g, (_, c) => `<code class="md-code">${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(
    /^(#{1,6})\s+(.+)$/gm,
    (_, h, t) => `<h${h.length} class="md-h">${t}</h${h.length}>`,
  );

  // 4. Unordered lists (runs of "- " / "* " lines).
  out = out.replace(/(?:^[-*] .+(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((l) => `<li>${l.replace(/^[-*] /, "")}</li>`)
      .join("");
    return `<ul class="md-ul">${items}</ul>`;
  });

  // 5. Line breaks, then restore code blocks (which must keep their newlines).
  out = out.replace(/\n/g, "<br>");
  out = out.replace(MARK_RE, (_, i) => blocks[Number(i)]);

  return out;
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("markdown.js")) {
  const { default: assert } = await import("node:assert");

  // XSS: script tags are escaped, never emitted raw
  const xss = renderMarkdown("<script>alert(1)</script>");
  assert.ok(!xss.includes("<script>"));
  assert.ok(xss.includes("&lt;script&gt;"));

  // bold + inline code
  assert.ok(renderMarkdown("**hi**").includes("<strong>hi</strong>"));
  assert.ok(renderMarkdown("`x`").includes('<code class="md-code">x</code>'));

  // fenced code block escapes its contents, keeps a copy button + lang label
  const code = renderMarkdown("```js\n<b>&\n```");
  assert.ok(code.includes("<pre"));
  assert.ok(code.includes("&lt;b&gt;&amp;"));
  assert.ok(!code.includes("<b>"));
  assert.ok(code.includes('class="md-copy"'));
  assert.ok(code.includes(">js</span>"));

  // list
  assert.ok(renderMarkdown("- a\n- b").includes("<li>a</li><li>b</li>"));

  // prose with a bare " 0 " right after a code block must survive intact
  const mixed = renderMarkdown("```\ncode\n```\nstep 0 done");
  assert.ok(mixed.includes("step 0 done"), mixed);
  assert.ok(mixed.includes("<pre"));

  console.log("markdown.js self-check OK");
}
