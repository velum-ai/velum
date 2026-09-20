// Shared by every outbound provider client (dodo.js, btcpay.js): which
// network errors are worth retrying once, and a plain sleep.

const NET_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export const isTransient = (err) =>
  err?.name === "TimeoutError" ||
  err?.name === "AbortError" ||
  NET_CODES.has(err?.code) ||
  NET_CODES.has(err?.cause?.code);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("httpRetry.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(isTransient({ name: "TimeoutError" }), true);
  assert.strictEqual(isTransient({ name: "AbortError" }), true);
  assert.strictEqual(isTransient({ code: "ECONNRESET" }), true);
  assert.strictEqual(isTransient({ cause: { code: "ENOTFOUND" } }), true);
  assert.strictEqual(isTransient(new Error("nope")), false);
  assert.strictEqual(isTransient({}), false);

  const start = Date.now();
  await wait(10);
  assert.ok(Date.now() - start >= 10);

  console.log("httpRetry.js self-check OK");
}
