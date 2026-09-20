import { parseSSE } from "@/lib/sse";
import { MAX_OUTPUT, IMAGE_MODEL } from "@/lib/pricing";

// The one module that speaks the provider wire format. velum talks to
// OpenRouter's OpenAI-compatible /chat/completions endpoint. UPSTREAM_BASE_URL
// and UPSTREAM_API_KEY override it for any other compatible provider. The
// caller only ever deals with chat-style { role, content } messages.

const OPENROUTER = "https://openrouter.ai/api/v1";
const BASE = (process.env.UPSTREAM_BASE_URL || OPENROUTER).replace(/\/$/, "");
const KEY = process.env.OPENROUTER_API_KEY || process.env.UPSTREAM_API_KEY;

// Forwarded to models that expose reasoning; ignored by the rest.
// "minimal" | "low" | "medium" | "high" | "off"
const REASONING_EFFORT = process.env.REASONING_EFFORT || "low";

// Hard backstops against a wedged upstream connection (ms).
const STREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 300_000;
const IMAGE_TIMEOUT_MS = Number(process.env.UPSTREAM_IMAGE_TIMEOUT_MS) || 120_000;

export const upstreamConfigured = () => Boolean(KEY);
export const imageConfigured = () => Boolean(KEY);

export function upstreamStatus() {
  return { configured: Boolean(KEY), base: BASE };
}

function headers() {
  const h = {
    "content-type": "application/json",
    authorization: `Bearer ${KEY}`,
  };
  if (BASE.includes("openrouter")) {
    h["X-Title"] = "velum";
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      h["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL;
    }
  }
  return h;
}

// Combine the caller's abort signal with a hard timeout so a stuck connection
// can never hang a request forever.
function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

// --- chat -----------------------------------------------------------------

async function* chatCompletionsEvents(body) {
  for await (const j of parseSSE(body)) {
    if (j.usage) yield { usage: j.usage };
    const d = j.choices?.[0]?.delta;
    if (!d) continue;
    if (d.content) yield { delta: d.content };
    // OpenRouter / DeepSeek stream reasoning here
    const r = d.reasoning ?? d.reasoning_content;
    if (r) yield { reasoning: r };
  }
}

// Start a streaming completion. Returns the upstream Response; the caller
// checks res.ok, then consumes chatEvents(res.body).
export function streamChat({ model, messages, signal, maxOutput = MAX_OUTPUT }) {
  const body = {
    model,
    messages,
    max_tokens: maxOutput,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (REASONING_EFFORT !== "off") body.reasoning = { effort: REASONING_EFFORT };

  return fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: withTimeout(signal, STREAM_TIMEOUT_MS),
  });
}

// Reduce provider SSE chunks to { delta } / { reasoning } / { usage }.
export function chatEvents(body) {
  return chatCompletionsEvents(body);
}

// --- image --------------------------------------------------------------

// One generated image via OpenRouter: /chat/completions with an image
// modality. The picture comes back as a data URL on the assistant message.
export async function generateImage({ prompt, signal }) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
    signal: withTimeout(signal, IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`image api ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json().catch(() => null);
  const img = data?.choices?.[0]?.message?.images?.[0];
  const url = img?.image_url?.url || img?.url || null;
  const m =
    typeof url === "string" && url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) throw new Error("image api returned no image");
  return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
}

// Live model catalogue with per-token pricing - used by `npm run sync-models`.
export async function fetchModelCatalogue() {
  const res = await fetch(`${BASE}/models`, { headers: headers() });
  if (!res.ok) throw new Error(`${BASE}/models -> ${res.status}`);
  const { data } = await res.json();
  return data;
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("upstream.js")) {
  const { default: assert } = await import("node:assert");

  const chatBody = new ReadableStream({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(
          'data: {"choices":[{"delta":{"reasoning":"hmm"}}]}\n\n' +
            'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
            'data: {"usage":{"prompt_tokens":3,"completion_tokens":1},"choices":[]}\n\n' +
            "data: [DONE]\n\n",
        ),
      );
      c.close();
    },
  });
  const ev = [];
  for await (const e of chatCompletionsEvents(chatBody)) ev.push(e);
  assert.deepStrictEqual(ev, [
    { reasoning: "hmm" },
    { delta: "hi" },
    { usage: { prompt_tokens: 3, completion_tokens: 1 } },
  ]);

  assert.strictEqual(typeof upstreamStatus().configured, "boolean");
  assert.strictEqual(typeof upstreamStatus().base, "string");

  console.log("upstream.js self-check OK");
}
