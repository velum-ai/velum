import dns from "node:dns/promises";
import { isTransient, wait } from "@/lib/httpRetry";
import { logError } from "@/lib/logger";

// The "fetch_url" tool's backend: reads one specific page's text content.
// No third-party key needed (it's a plain fetch), so unlike web_search/
// run_python this is always available and free - the surcharge on the other
// two is for their paid providers, not for velum's own bandwidth.
//
// Runs directly on velum's own server (not sandboxed, unlike run_python), so
// this is the one tool with real SSRF exposure: a model-chosen URL must
// never be able to reach internal services or cloud metadata endpoints.

const TIMEOUT_MS = 8_000;
const MAX_CHARS = 20_000;
const MAX_BYTES = 3 * 1024 * 1024;

function isPrivateIp(ip) {
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true; // link-local, includes cloud metadata IPs
  if (/^f[cd][0-9a-f]{0,2}:/i.test(ip)) return true; // IPv6 unique local
  if (/^fe80:/i.test(ip)) return true; // IPv6 link-local
  return false;
}

async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("only http/https urls are allowed");
  }
  if (url.hostname === "localhost") throw new Error("that host isn't reachable");
  const addrs = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("could not resolve that host");
  if (addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("that host isn't reachable");
  }
  return url;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// -> plain text for the model to read as the tool result. Never throws: a
// bad url or a dead page degrades to an error string, not a broken chat.
export async function fetchUrl(rawUrl) {
  if (!rawUrl) return "error: no url given";

  let url;
  try {
    url = await assertSafeUrl(rawUrl);
  } catch (err) {
    return `error: ${err.message}`;
  }

  const call = () =>
    fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; velum/1.0)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res;
  try {
    res = await call();
  } catch (err) {
    if (!isTransient(err)) {
      logError("fetch_url_failed", err, { url: rawUrl });
      return "error: could not reach that url";
    }
    await wait(300);
    try {
      res = await call();
    } catch (err2) {
      logError("fetch_url_failed", err2, { url: rawUrl });
      return "error: could not reach that url";
    }
  }

  if (!res.ok) return `error: page returned ${res.status}`;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return `error: unsupported content type (${contentType.split(";")[0] || "unknown"})`;
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return "error: page too large";

  const body = Buffer.from(buf).toString("utf8");
  const text = contentType.includes("text/html") ? stripHtml(body) : body;
  return text.slice(0, MAX_CHARS) || "(empty page)";
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("fetchUrl.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(await fetchUrl(""), "error: no url given");
  assert.strictEqual(await fetchUrl("not a url"), "error: invalid url");
  assert.strictEqual(
    await fetchUrl("ftp://example.com/file"),
    "error: only http/https urls are allowed",
  );
  assert.strictEqual(
    await fetchUrl("http://localhost:3000"),
    "error: that host isn't reachable",
  );
  assert.strictEqual(
    await fetchUrl("http://127.0.0.1"),
    "error: that host isn't reachable",
  );
  assert.strictEqual(
    await fetchUrl("http://169.254.169.254/latest/meta-data"),
    "error: that host isn't reachable",
  );

  console.log("fetchUrl.js self-check OK");
}
