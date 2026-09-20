// Client-side JSON fetch: one place for headers, body encoding, and the
// { ok, status, data } result shape. Network failure → ok:false, status 0.
// Streaming calls (the chat SSE) don't fit this shape and use fetch directly.
export async function api(url, { method = "POST", body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      ...(body !== undefined && {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}
