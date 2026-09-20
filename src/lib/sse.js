// One SSE parser for both sides of the wire: the server reading the provider's
// stream and the browser reading ours. Isomorphic, zero deps.

// Parse an SSE byte stream (ReadableStream) into JSON payloads: buffers
// partial chunks, yields one parsed object per `data:` line, skips [DONE]
// and unparseable lines.
export async function* parseSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield JSON.parse(payload);
      } catch {
        // partial or malformed frame - skip
      }
    }
  }
}

// self-check: node src/lib/sse.js
if (process.argv[1] && process.argv[1].endsWith("sse.js")) {
  const { default: assert } = await import("node:assert");

  const streamOf = (...chunks) =>
    new ReadableStream({
      start(c) {
        const e = new TextEncoder();
        for (const chunk of chunks) c.enqueue(e.encode(chunk));
        c.close();
      },
    });

  const collect = async (body) => {
    const out = [];
    for await (const json of parseSSE(body)) out.push(json);
    return out;
  };

  // frames split mid-line across chunks must reassemble
  assert.deepStrictEqual(
    await collect(streamOf('data: {"a"', ':1}\n\ndata: {"b":2}\n\n')),
    [{ a: 1 }, { b: 2 }],
  );

  // [DONE], blank lines, non-data lines, malformed JSON all skipped
  assert.deepStrictEqual(
    await collect(streamOf('event: x\ndata: {"ok":true}\n\ndata: nope\n\ndata: [DONE]\n\n')),
    [{ ok: true }],
  );

  console.log("sse.js self-check OK");
}
