import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Stable module-level arrays/objects, not recreated per render: react-markdown
// re-processes the plugin pipeline whenever these references change identity,
// so a fresh array/object literal on every render would mean reprocessing
// (and, worse, a flash of unstyled content) on every single keystroke/paint
// tick during streaming.

// output: "html" - skip generating the parallel (invisible) MathML tree
// KaTeX emits by default. Its only purpose is screen-reader accessibility,
// and it exists only as extra <math>/<semantics>/<mi>/<mo>/... tags we'd
// otherwise have to allowlist below for no visual benefit; html-only output
// is exclusively <span> elements, visually identical either way.
const rehypeKatexOptions = { throwOnError: false, output: "html" };

// hast-util-sanitize's default schema (GitHub's own) already covers plain
// GFM safely - tables, task-list checkboxes, strikethrough, and crucially
// restricts `href`/`src` to http/https/mailto/irc (no javascript:, no data:
// on links) with zero extra config needed here.
//
// KaTeX's own HTML output is the one thing it doesn't anticipate: dozens of
// non-"katex"-prefixed span classes (mord, vlist-t, frac-line, ...) plus
// inline `style` for precise glyph positioning, neither of which the default
// schema allows on any element. Both are safe to allow specifically on
// <span> - this is KaTeX's own trusted rendering output (built from a
// parsed LaTeX AST, not reparsed attacker HTML), the same trust boundary
// the rest of this schema already extends to every other tag it allows.
export const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), "className", "style"],
  },
};

// Single-dollar inline math ($x$) is disabled: remark-math's own docs warn
// it "often interferes with normal dollars in text", and in testing it
// genuinely did - "that costs $5 and $10 more" parsed as math spanning "5
// and" with no currency disambiguation at all (unlike Pandoc's rule, which
// is what the hand-rolled renderer this replaced used). $$...$$ is
// unambiguous even inline (it reads as display math only when on its own
// line, surrounded by blank lines) and is what's left enabled.
export const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]];
export const rehypePlugins = [[rehypeKatex, rehypeKatexOptions], [rehypeSanitize, sanitizeSchema]];

// remark-math only recognizes $ / $$, not the \( \) / \[ \] delimiters
// models (particularly OpenAI's) commonly emit too. Normalize those to $$
// before the real parse, skipping fenced code regions so a code sample
// that happens to contain a literal "\(" (e.g. regex source) is never
// touched - same protection the old renderer gave code blocks.
export function preprocessMath(text) {
  const src = String(text ?? "");
  const codeRe = /```[\s\S]*?```/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = codeRe.exec(src))) {
    parts.push({ code: false, text: src.slice(last, m.index) });
    parts.push({ code: true, text: m[0] });
    last = m.index + m[0].length;
  }
  parts.push({ code: false, text: src.slice(last) });

  return parts
    .map((p) =>
      p.code
        ? p.text
        : p.text
            .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body}$$`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$$${body}$$`),
    )
    .join("");
}

// self-check: npm test
// No JSX here (this runs through plain `node`, not a bundler) - React.createElement
// directly instead.
if (process.argv[1] && process.argv[1].endsWith("markdownPlugins.js")) {
  const { default: assert } = await import("node:assert");
  const { default: React } = await import("react");
  const { default: ReactMarkdown } = await import("react-markdown");
  const { renderToStaticMarkup } = await import("react-dom/server");

  const render = (src) =>
    renderToStaticMarkup(
      React.createElement(ReactMarkdown, { remarkPlugins, rehypePlugins }, preprocessMath(src)),
    );

  // XSS: raw HTML in the source is never passed through as live markup -
  // no rehype-raw plugin is in this pipeline, so it's literal text.
  const xss = render("<script>alert(1)</script>");
  assert.ok(!xss.includes("<script>"), xss);

  // GFM table renders as a real <table>, not pipe-delimited text
  const table = render("| a | b |\n| --- | --- |\n| 1 | 2 |");
  assert.ok(table.includes("<table"), table);
  assert.ok(table.includes("<td>1</td>") || /<td>\s*1\s*<\/td>/.test(table), table);

  // link scheme safety: a plain https link keeps its href, a javascript:
  // one has it stripped by rehype-sanitize's protocol allowlist
  const safeLink = render("[text](https://example.com)");
  assert.ok(safeLink.includes('href="https://example.com"'), safeLink);
  const dangerLink = render("[text](javascript:alert(1))");
  assert.ok(!dangerLink.includes("javascript:"), dangerLink);

  // math renders through KaTeX
  const math = render("$$x = 1$$");
  assert.ok(math.includes("katex"), math);
  assert.ok(!math.includes("$"), math);

  // currency must never be misread as math - singleDollarTextMath is off
  // specifically because the default behavior failed this exact case
  const currency = render("that costs $5 and $10 more");
  assert.ok(!currency.includes("katex"), currency);
  assert.ok(currency.includes("$5") && currency.includes("$10"), currency);

  // display math ($$) still works, including inline (not surrounded by
  // blank lines)
  const display = render("price is $$x = 1$$ dollars");
  assert.ok(display.includes("katex"), display);

  // \( \) / \[ \] normalize to $$ before parsing and also render as math
  const parenMath = render("\\(x = 1\\)");
  assert.ok(parenMath.includes("katex"), parenMath);
  const bracketMath = render("\\[x = 1\\]");
  assert.ok(bracketMath.includes("katex"), bracketMath);

  // ...but a literal "\(" inside a fenced code block must never be touched
  const codeWithParen = render("```\nregex: \\(abc\\)\n```");
  assert.ok(!codeWithParen.includes("katex"), codeWithParen);
  assert.ok(codeWithParen.includes("\\(abc\\)"), codeWithParen);

  // malformed LaTeX degrades instead of throwing / losing the whole reply
  assert.doesNotThrow(() => render("$$\\frac{1$$"));

  console.log("markdownPlugins.js self-check OK");
}
