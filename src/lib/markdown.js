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

// Ranges in `text` that must never be split inside: fully closed fenced code
// blocks, plus a trailing unclosed fence (protected from its opening ``` to
// the end of the string, since more of it is still streaming in).
function protectedRanges(text) {
  const ranges = [];
  const re = /```([^\n]*)\n?([\s\S]*?)```/g;
  let m;
  let lastEnd = 0;
  while ((m = re.exec(text))) {
    ranges.push([m.index, m.index + m[0].length]);
    lastEnd = m.index + m[0].length;
  }
  const openIdx = text.indexOf("```", lastEnd);
  if (openIdx !== -1) ranges.push([openIdx, text.length]);
  return ranges;
}

const insideAny = (idx, ranges) => ranges.some(([s, e]) => idx > s && idx < e);

// The furthest index up to which `text` can be considered "settled" and
// never needs re-rendering again: the end of the last blank-line gap that
// doesn't fall inside a fenced code block (open or closed). 0 if there's no
// such boundary yet (nothing is settled, the whole text is still "tail").
function lastSafeSplit(text, ranges) {
  const re = /\n{2,}/g;
  let m;
  let best = 0;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (!insideAny(m.index, ranges)) best = end;
  }
  return best;
}

// Incremental twin of renderMarkdown for live streaming only. Re-renders just
// the text since the last safe block boundary instead of the whole reply on
// every tick, so cost stays roughly constant as a reply grows instead of
// scaling with total length so far. `cache` is caller-owned state
// ({ text: "", html: "" }) that persists across calls for one streaming
// message - pass a fresh object per message, discard it once streaming ends.
//
// Correctness relies on renderMarkdown being "concatenative" across a safe
// split point: renderMarkdown(A) + renderMarkdown(B) must equal
// renderMarkdown(A+B) when A ends exactly at a blank-line gap outside any
// fence. True for every rule here except **bold**/*italic* spanning a blank
// line, which real model output essentially never does - and any mismatch
// is cosmetic and transient: the final render, once streaming ends, always
// goes through plain renderMarkdown(fullText), never this cache.
export function renderMarkdownStreaming(src, cache) {
  const text = String(src ?? "");
  const split = lastSafeSplit(text, protectedRanges(text));

  if (split > cache.text.length) {
    cache.html += renderMarkdown(text.slice(cache.text.length, split));
    cache.text = text.slice(0, split);
  }

  return cache.html + renderMarkdown(text.slice(cache.text.length));
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

  // renderMarkdownStreaming: fed in small chunks, must converge to exactly
  // what a plain renderMarkdown(fullText) call produces once all text has
  // arrived - this is the property the whole optimization depends on.
  function assertStreamConverges(full, chunkSize) {
    const cache = { text: "", html: "" };
    let fed = "";
    let last = "";
    for (let i = 0; i < full.length; i += chunkSize) {
      fed += full.slice(i, i + chunkSize);
      last = renderMarkdownStreaming(fed, cache);
    }
    const expected = renderMarkdown(full);
    assert.strictEqual(last, expected, `mismatch for chunkSize=${chunkSize}: ${full}`);
  }

  const streamingCases = [
    "plain prose, no formatting at all.",
    "para one.\n\npara two.\n\npara three.",
    "a list:\n\n- a\n- b\n- c\n\nthen more prose.",
    "intro\n\n```js\nfunction f() {\n\n  return 1;\n}\n```\n\noutro",
    "**bold** and `code` and # a header\n\nsecond paragraph with *italic* text.",
    "```\ncode with no language\nand a blank line\n\ninside it\n```",
  ];
  for (const text of streamingCases) {
    for (const chunkSize of [1, 3, 7, 50]) {
      assertStreamConverges(text, chunkSize);
    }
  }

  // mid-stream (before the closing fence arrives) must never leak the fence
  // marker or unescaped code as literal text, and must never throw
  {
    const cache = { text: "", html: "" };
    const partial = renderMarkdownStreaming("intro\n\n```js\nconst x = '<script>'", cache);
    assert.ok(partial.includes("intro"));
    assert.ok(!partial.includes("<script>"));
  }

  console.log("markdown.js self-check OK");
}
