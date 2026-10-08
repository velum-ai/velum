// Fallback tool-calling for models with no native tool-calling support on
// OpenRouter. Checked directly against the live catalogue: every current
// "uncensored" tier model (Dolphin, Hermes, Euryale, Cydonia, ...) reports
// tools:false, and the one that looked supported on paper (l3.1-euryale-70b)
// 400s or gets filtered out of routing by every provider actually serving it.
// Sending them `tools` either errors outright or is silently ignored, so
// those models never get a chance to use web_search/fetch_url/run_python/
// generate_image at all.
//
// Instead of the structured tool_calls format, the model is instructed to
// emit a plain-text [TOOL_CALL]{...}[/TOOL_CALL] marker in its own reply.
// This module turns the raw token stream into the same { delta } / { call }
// shape a real tool-calling loop consumes, so src/app/api/chat/route.js's
// pipeline (billing, toolStart/toolEnd/toolFile events, exchange.js) doesn't
// need to know which kind of model it's talking to - see promptToolLoopEvents
// in route.js, which is the prompt-based twin of toolLoopEvents.
//
// This is a known-weaker substitute, not a claim of parity: a model not
// instruction-tuned for structured output can ignore the format, narrate a
// fake result instead of calling for real, or wrap the JSON in prose. The
// scanner and parser below are defensive about all of that, but no amount of
// prompting fully closes the gap to real function-calling.

const OPEN = "[TOOL_CALL]";
const CLOSE = "[/TOOL_CALL]";

export const TOOL_CALL_STOP = CLOSE;

// One line per tool, derived from the same OpenAI-style tool defs the native
// path sends as `tools` - single source of truth, nothing to keep in sync.
export function describeToolsForPrompt(tools) {
  const lines = tools.map((t) => {
    const f = t.function;
    const props = f.parameters?.properties || {};
    const required = f.parameters?.required || [];
    const args = Object.entries(props)
      .map(([k, v]) => `${k}${required.includes(k) ? "" : "?"}: ${v.description || v.type}`)
      .join(", ");
    return `- ${f.name}(${args}): ${f.description}`;
  });

  return [
    "You have tools available. To use one, stop writing prose at exactly that point and emit this, nothing else on those lines:",
    OPEN,
    '{"name": "<tool name>", "arguments": {...}}',
    CLOSE,
    "Valid JSON only, then stop completely - do not guess, narrate, or pre-write what the result will be, wait for it to come back. Tools:",
    ...lines,
    "Only call a tool when you actually need it; otherwise just answer normally. After a result comes back you may call another tool or give your final answer in plain text.",
  ].join("\n");
}

// One scanner instance per completion round: feed it each streamed chunk in
// order, it yields { delta } for text to show the user and { call: rawJson }
// once a complete marker closes. Holds back a tail that could be the start
// of OPEN so a partial marker is never flashed to the user mid-stream.
export function createToolCallScanner() {
  let buffer = "";
  let inCall = false;

  function* feed(text) {
    buffer += text;
    for (;;) {
      if (!inCall) {
        const i = buffer.indexOf(OPEN);
        if (i === -1) {
          const safe = safeEmitLength(buffer, OPEN);
          if (safe > 0) {
            yield { delta: buffer.slice(0, safe) };
            buffer = buffer.slice(safe);
          }
          return;
        }
        if (i > 0) yield { delta: buffer.slice(0, i) };
        buffer = buffer.slice(i + OPEN.length);
        inCall = true;
        continue;
      }
      const j = buffer.indexOf(CLOSE);
      if (j === -1) return; // still inside a call, keep buffering silently
      yield { call: buffer.slice(0, j).trim() };
      buffer = buffer.slice(j + CLOSE.length);
      inCall = false;
    }
  }

  // Call once the round's stream has ended. The caller sets the `stop`
  // request param to TOOL_CALL_STOP, which makes the provider consume the
  // closing marker itself and never send it in the stream - feed() alone
  // would then wait forever for a close tag that's never coming, and
  // silently swallow the whole call into its buffer. If a call was opened
  // but the stream ended before a close ever arrived, that truncation IS
  // the stop sequence firing exactly as asked: whatever's buffered is the
  // complete call. Otherwise (never opened a call) there's nothing to flush.
  function flush() {
    if (!inCall) return null;
    const call = buffer.trim();
    buffer = "";
    inCall = false;
    return call ? { call } : null;
  }

  return { feed, flush };
}

// How much of `buf`'s tail could still turn into `marker` as more text
// arrives - that part must not be emitted yet.
function safeEmitLength(buf, marker) {
  const max = Math.min(marker.length - 1, buf.length);
  for (let len = max; len > 0; len--) {
    if (marker.startsWith(buf.slice(buf.length - len))) return buf.length - len;
  }
  return buf.length;
}

// raw text between the markers -> { name, arguments } with arguments as a
// JSON string, matching the shape runTool() already expects from the native
// tool_calls path. null on anything that doesn't parse as {name, ...}.
export function parseToolCall(raw) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj.name !== "string") return null;
  return { name: obj.name, arguments: JSON.stringify(obj.arguments ?? {}) };
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("promptTools.js")) {
  const { default: assert } = await import("node:assert");

  // describeToolsForPrompt stays in sync with the tool def shape
  const desc = describeToolsForPrompt([
    {
      function: {
        name: "web_search",
        description: "Search the web.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
    },
  ]);
  assert.ok(desc.includes("web_search(query: "));
  assert.ok(desc.includes(OPEN) && desc.includes(CLOSE));

  // scanner: plain text, no call
  {
    const { feed, flush } = createToolCallScanner();
    const out = [...feed("just a normal reply, no tools needed.")];
    assert.deepStrictEqual(out, [{ delta: "just a normal reply, no tools needed." }]);
    assert.strictEqual(flush(), null); // never opened a call - nothing to flush
  }

  // scanner: a call split across many small chunks, including mid-marker,
  // WITH the close tag present in-stream (no stop sequence truncation)
  {
    const { feed } = createToolCallScanner();
    // a real caller stops consuming the round once a call closes; nothing
    // is fed after CALL] here, matching that
    const chunks = [
      "let me check. ",
      "[TOOL",
      "_CALL]",
      '{"name":"web_search",',
      '"arguments":{"query":"x"}}',
      "[/TOOL_",
      "CALL]",
    ];
    const events = chunks.flatMap((c) => [...feed(c)]);
    const deltas = events.filter((e) => e.delta).map((e) => e.delta).join("");
    const calls = events.filter((e) => e.call);
    assert.strictEqual(deltas, "let me check. ");
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].call, '{"name":"web_search","arguments":{"query":"x"}}');
  }

  // scanner: a partial OPEN at the very end of a chunk is held back, not emitted early
  {
    const { feed } = createToolCallScanner();
    const out1 = [...feed("here's some text [TOOL_C")];
    assert.deepStrictEqual(out1, [{ delta: "here's some text " }]);
    const out2 = [...feed("ALL]{\"name\":\"x\",\"arguments\":{}}[/TOOL_CALL]")];
    assert.strictEqual(out2.filter((e) => e.call).length, 1);
  }

  // scanner: the exact bug this was built to catch - a `stop` sequence set
  // to TOOL_CALL_STOP means the provider never sends the close tag at all,
  // so feed() alone never yields a call; flush() after the stream ends must
  // recover it from the buffer, or a real tool call silently vanishes.
  {
    const { feed, flush } = createToolCallScanner();
    const out = [
      ...feed("[TOOL_CALL]\n"),
      ...feed('{"name": "web_search", "arguments": {"query": "x"}}\n'),
      // stream ends here - provider stopped at TOOL_CALL_STOP, close tag
      // was consumed by the stop mechanism and never streamed
    ];
    assert.strictEqual(out.filter((e) => e.call).length, 0); // feed() alone: nothing
    const flushed = flush();
    assert.ok(flushed);
    assert.strictEqual(
      flushed.call,
      '{"name": "web_search", "arguments": {"query": "x"}}',
    );
    assert.strictEqual(flush(), null); // one-shot, nothing left after
  }

  // parseToolCall
  assert.deepStrictEqual(parseToolCall('{"name":"web_search","arguments":{"query":"x"}}'), {
    name: "web_search",
    arguments: '{"query":"x"}',
  });
  assert.deepStrictEqual(parseToolCall('{"name":"generate_image"}'), {
    name: "generate_image",
    arguments: "{}",
  });
  assert.strictEqual(parseToolCall("not json"), null);
  assert.strictEqual(parseToolCall('{"no_name_field":1}'), null);

  console.log("promptTools.js self-check OK");
}
