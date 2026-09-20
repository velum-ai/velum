// Minimal structured logger - single-line JSON to stdout/stderr. Works the
// same in dev, `next build && next start`, and behind pm2 (which writes
// these to ~/.pm2/logs/<app>-out.log and -error.log automatically). Running
// it plain? Redirect yourself: `next start >> app.log 2>&1`.

export function log(event, data = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
}

export function logError(event, err, data = {}) {
  // Node's fetch reports "fetch failed" and hides the real reason on err.cause
  // (ENOTFOUND, ECONNREFUSED, UND_ERR_CONNECT_TIMEOUT, cert errors, ...).
  const cause = err?.cause;
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      event,
      error: err?.message || String(err),
      ...(cause && { cause: cause.code || cause.message || String(cause) }),
      ...data,
    }),
  );
}
