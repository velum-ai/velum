import {
  reserveCredits,
  settleCredits,
  getHistory,
  truncateMessages,
} from "@/lib/account";
import { exchangeResponse } from "@/lib/exchange";
import { guardRequest, bad } from "@/lib/guard";
import { checkRateLimit } from "@/lib/rateLimit";
import { streamChat, chatEvents, upstreamConfigured } from "@/lib/upstream";
import { isAllowedModel, worstCaseCredits, outputCapFor } from "@/lib/pricing";
import { logError } from "@/lib/logger";
import {
  DEFAULT_MODEL,
  MAX_IMAGES,
  MAX_DATA_URL_LENGTH,
  MAX_REQUEST_BYTES,
  IMAGE_DATA_URL,
} from "@/lib/limits";

export const dynamic = "force-dynamic";

// Sliding context window: resend the last 20 messages (10 exchanges). The
// provider auto-caches the stable prefix at ~10% price where supported.
const HISTORY_WINDOW = 20;


// client-supplied context for an ephemeral chat: text only, roles fixed, last
// HISTORY_WINDOW turns, each turn length-capped.
const sanitizeHistory = (h) =>
  (Array.isArray(h) ? h : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }));

const validImages = (images) =>
  images === undefined ||
  (Array.isArray(images) &&
    images.length <= MAX_IMAGES &&
    images.every(
      (url) =>
        typeof url === "string" &&
        url.length <= MAX_DATA_URL_LENGTH &&
        IMAGE_DATA_URL.test(url),
    ));

export async function POST(req) {
  if (!upstreamConfigured()) return bad("chat is not configured", 503);
  if (Number(req.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
    return bad("request too large", 413);
  }

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid request", 400);
  const {
    account,
    chatId,
    message,
    model: bodyModel,
    images,
    ephemeral,
    history: clientHistory,
    truncateAfterId,
    appendUser: appendUserRaw,
    length,
  } = body;

  const g = await guardRequest(req, {
    key: "chat",
    limit: 30,
    windowMs: 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const perAccount = await checkRateLimit(`chat-acct:${account}`, {
    limit: 40,
    windowMs: 60_000,
  });
  if (!perAccount.allowed) return bad("too many requests, try again later", 429);

  const appendUser = appendUserRaw !== false; // default true; false = regenerate
  const rewindTo = Number.isInteger(truncateAfterId) ? truncateAfterId : null;

  // uniform with account errors: don't leak which field was bad
  if (appendUser && !message && !(Array.isArray(images) && images.length)) {
    return bad("invalid account", 400);
  }
  if (!validImages(images)) return bad("invalid images", 400);

  const model = bodyModel || DEFAULT_MODEL;
  if (!isAllowedModel(model)) return bad("invalid model", 400);

  const messageText = message || "";

  // edit / regenerate: rewind the stored thread first, then rebuild context.
  if (rewindTo !== null && !ephemeral && chatId) {
    await truncateMessages(account, chatId, rewindTo);
  }

  // ephemeral chats are never persisted, so context comes from the client;
  // normal chats pull it from the db by chatId.
  const history = ephemeral
    ? sanitizeHistory(clientHistory)
    : await getHistory(account, chatId, HISTORY_WINDOW);

  const systemPrompt = g.record?.systemPrompt || null;

  // reserve against the whole resent prompt, not just the new message
  const promptParts = [
    ...(systemPrompt ? [systemPrompt] : []),
    ...history.map((m) => m.content),
    ...(appendUser ? [messageText] : []),
  ];
  const r = await reserveCredits(
    account,
    worstCaseCredits(model, promptParts.join("\n")),
  );
  if (!r.ok) return bad("not enough credits", 402);

  const userContent = images?.length
    ? [
        ...(message ? [{ type: "text", text: message }] : []),
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : message;

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history,
    ...(appendUser ? [{ role: "user", content: userContent }] : []),
  ];

  let upstream;
  try {
    upstream = await streamChat({
      model,
      messages,
      maxOutput: outputCapFor(length),
      signal: req.signal,
    });
  } catch (err) {
    logError("upstream_request_failed", err, { model });
    await settleCredits(r.reservationId, 0);
    return bad("upstream request failed", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    logError("upstream_api_error", new Error(detail || `status ${upstream.status}`), {
      status: upstream.status,
      model,
    });
    await settleCredits(r.reservationId, 0); // full refund, nothing was generated
    const msg =
      upstream.status === 429
        ? "the model is busy right now, try again in a moment"
        : upstream.status === 402 || upstream.status === 403
          ? "this model is temporarily unavailable, try another"
          : "the model provider had an error, try again";
    return bad(msg, 502);
  }

  const storedMessage = images?.length
    ? [message, `[${images.length} image${images.length > 1 ? "s" : ""}]`]
        .filter(Boolean)
        .join(" ")
    : message;

  return exchangeResponse({
    account,
    reservationId: r.reservationId,
    chatId,
    model,
    promptText: promptParts.join("\n"),
    storedMessage,
    images,
    events: chatEvents(upstream.body),
    appendUser,
    ephemeral: !!ephemeral,
  });
}
