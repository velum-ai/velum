import {
  reserveCredits,
  settleCredits,
  getHistory,
  truncateMessages,
} from "@/lib/account";
import { exchangeResponse } from "@/lib/exchange";
import { guardRequest, bad } from "@/lib/guard";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  streamChat,
  chatEvents,
  upstreamConfigured,
  generateImage,
  imageConfigured,
} from "@/lib/upstream";
import {
  isAllowedModel,
  worstCaseCredits,
  outputCapFor,
  searchCredits,
  codeCredits,
  imageCredits,
} from "@/lib/pricing";
import { searchText, searchConfigured } from "@/lib/webSearch";
import { runCode, codeExecConfigured } from "@/lib/codeExec";
import { fetchUrl } from "@/lib/fetchUrl";
import { logError } from "@/lib/logger";
import {
  DEFAULT_MODEL,
  MAX_IMAGES,
  MAX_DATA_URL_LENGTH,
  MAX_REQUEST_BYTES,
  IMAGE_DATA_URL,
  MAX_FILES,
  MAX_FILE_DATA_URL_LENGTH,
  FILE_DATA_URL,
  MAX_FILE_TEXT_CHARS,
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

// { name, url } pairs: url is a text/plain|text/markdown data: URL. The name
// is display-only (shown in the composer and, if we ever re-render it, chat
// history) - never trusted for anything else.
const validFiles = (files) =>
  files === undefined ||
  (Array.isArray(files) &&
    files.length <= MAX_FILES &&
    files.every(
      (f) =>
        f &&
        typeof f.name === "string" &&
        f.name.length <= 200 &&
        typeof f.url === "string" &&
        f.url.length <= MAX_FILE_DATA_URL_LENGTH &&
        FILE_DATA_URL.test(f.url),
    ));

async function extractText(f) {
  const buffer = Buffer.from(f.url.split(",")[1], "base64");
  if (f.url.startsWith("data:application/pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  return buffer.toString("utf8");
}

async function decodeFile(f) {
  let text;
  try {
    text = await extractText(f);
  } catch (e) {
    logError("file_extract_failed", e, { name: f.name });
    text = "[could not read this file]";
  }
  return `[attached file: ${f.name}]\n${text.slice(0, MAX_FILE_TEXT_CHARS)}`;
}

const RUN_PYTHON_TOOL = {
  type: "function",
  function: {
    name: "run_python",
    description:
      "Execute Python code in an isolated sandbox and return its output (stdout plus the last expression's value, or an error). Use it for calculations, data work, or checking an answer before replying. To hand the user a real downloadable file (PDF, image, csv...), write it to disk with a library like reportlab or matplotlib AND set output_file to that exact path in this same call, every time you write a file. This is required, not optional: if you write a file but leave output_file empty, the user gets NOTHING, telling them a sandbox path in your text reply is useless since the sandbox is destroyed right after the call. Only stdlib is guaranteed installed; if a library you need isn't there, you may pip install it in one call and use it in a following call, nothing persists between separate calls, and there's no general internet access beyond pip installs.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The Python code to run." },
        output_file: {
          type: "string",
          description:
            "Required whenever the code writes a file meant for the user: its exact path (e.g. /tmp/report.pdf). This is the only way the file reaches the user, mentioning the path in your reply text does nothing. Omit only when there's truly nothing to download.",
        },
      },
      required: ["code"],
    },
  },
};

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web and return the top results (title, url, description) for a query. Use it for anything time-sensitive, recent, or that you're not confident about from memory alone. Returns snippets only, not a page's full content, use fetch_url for that.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
      },
      required: ["query"],
    },
  },
};

const FETCH_URL_TOOL = {
  type: "function",
  function: {
    name: "fetch_url",
    description:
      "Fetch one specific web page by URL and return its visible text content in full. Use this when the user gives you a link, or when a web_search result's snippet isn't enough and you need the whole page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch, including https://." },
      },
      required: ["url"],
    },
  },
};

const GENERATE_IMAGE_TOOL = {
  type: "function",
  function: {
    name: "generate_image",
    description: "Generate an image from a text description and hand it back to the user.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What the image should show." },
      },
      required: ["prompt"],
    },
  },
};

// Run whichever tool the model asked for, dispatched by name. Always
// resolves to { text, file }, even on a bad/unknown call, so every
// tool_call_id gets a valid tool response and the follow-up request is
// never malformed. `file` is set by run_python's output_file or by
// generate_image, never by web_search/fetch_url.
async function runTool(name, argsJson) {
  let args = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    // leave args empty - each branch below has its own "missing input" error
  }
  if (name === "web_search") {
    const text = (await searchText(args.query || "")) || "no results found";
    return { text, file: null };
  }
  if (name === "fetch_url") {
    return { text: await fetchUrl(args.url || ""), file: null };
  }
  if (name === "run_python") {
    return runCode(args.code || "", args.output_file);
  }
  if (name === "generate_image") {
    if (!args.prompt) return { text: "error: no prompt given", file: null };
    try {
      const img = await generateImage({ prompt: args.prompt });
      const ext = img.mime.split("/")[1] || "png";
      return {
        text: "generated the image",
        file: { buffer: img.buffer, mime: img.mime, name: `image.${ext}` },
      };
    } catch (err) {
      logError("image_generation_failed", err);
      return { text: "error: image generation failed", file: null };
    }
  }
  return { text: `error: unknown tool "${name}"`, file: null };
}

// Up to MAX_TOOL_ROUNDS tool round-trips on top of an already-started first
// stream (a common real pattern needs two: install a library, then use it,
// e.g. after a ModuleNotFoundError - one round can't recover from that).
// The final round always goes out tools-off, so the model is forced to
// produce a real answer instead of looping forever. Forwards delta/reasoning
// live as they arrive across every round, so the caller sees one continuous
// stream. Yields one combined `usage` at the end (all rounds summed) and a
// `toolBilled` event per actual call (not deduped - the same tool can be
// billed more than once per exchange). Round 1's request itself, and its
// ok-check, are the caller's job (same as the no-tools path); this only
// takes over once round 1 is already streaming.
const MAX_TOOL_ROUNDS = 3;

async function* toolLoopEvents({ firstEvents, model, messages, tools, maxOutput, signal }) {
  let events = firstEvents;
  let history = messages;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let toolRoundsUsed = 0;

  // +1: guarantees one extra iteration to actually consume the forced
  // tools-off final round after the last allowed tool call, not just fetch it.
  for (let i = 0; i <= MAX_TOOL_ROUNDS; i++) {
    let usage = null;
    let replyText = "";
    const toolCalls = [];

    for await (const ev of events) {
      if (ev.usage) usage = ev.usage;
      if (ev.toolCalls) {
        toolCalls.push(...ev.toolCalls);
        continue; // finish_reason=tool_calls ends the turn, nothing else to forward
      }
      if (ev.delta) {
        replyText += ev.delta;
        yield { delta: ev.delta };
      }
      if (ev.reasoning) yield { reasoning: ev.reasoning };
    }
    totalPromptTokens += usage?.prompt_tokens || 0;
    totalCompletionTokens += usage?.completion_tokens || 0;

    if (!toolCalls.length) break; // model answered normally, done
    toolRoundsUsed++;

    // Defense in depth: a provider quirk that yields the same tool_use id
    // twice must never mean running (and billing) the same call twice.
    const seenIds = new Set();
    const uniqueToolCalls = toolCalls.filter((tc) =>
      seenIds.has(tc.id) ? false : (seenIds.add(tc.id), true),
    );

    for (const tc of uniqueToolCalls) {
      let args = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {
        // toolStart just previews the call - runTool handles the bad JSON for real
      }
      yield {
        toolStart: {
          name: tc.name,
          code: args.code,
          query: args.query,
          url: args.url,
          prompt: args.prompt,
        },
      };
    }

    const results = await Promise.all(
      uniqueToolCalls.map(async (tc) => ({
        tc,
        result: await runTool(tc.name, tc.arguments),
      })),
    );

    for (const r of results) {
      yield { toolEnd: { name: r.tc.name, output: r.result.text } };
      if (r.result.file) yield { toolFile: r.result.file };
      // billed once per actual call, not deduped by name - the model can
      // (and did, in testing) call the same tool more than once in one reply
      yield { toolBilled: r.tc.name };
    }

    history = [
      ...history,
      {
        role: "assistant",
        content: replyText || null,
        tool_calls: uniqueToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      },
      ...results.map((r) => ({
        role: "tool",
        tool_call_id: r.tc.id,
        content: r.result.text,
      })),
    ];

    const toolsAllowedNext = toolRoundsUsed < MAX_TOOL_ROUNDS;
    let next;
    try {
      next = await streamChat({
        model,
        messages: history,
        tools: toolsAllowedNext ? tools : undefined, // out of rounds: force a real answer
        maxOutput,
        signal,
      });
    } catch (err) {
      logError("upstream_request_failed", err, { model, round: i + 2 });
      break;
    }
    if (!next.ok || !next.body) {
      const detail = await next.text().catch(() => "");
      logError("upstream_api_error", new Error(detail || `status ${next.status}`), {
        status: next.status,
        model,
        round: i + 2,
      });
      break;
    }
    events = chatEvents(next.body);
  }

  yield {
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
    },
  };
}

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
    files,
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
  if (
    appendUser &&
    !message &&
    !(Array.isArray(images) && images.length) &&
    !(Array.isArray(files) && files.length)
  ) {
    return bad("invalid account", 400);
  }
  if (!validImages(images)) return bad("invalid images", 400);
  if (!validFiles(files)) return bad("invalid files", 400);

  const model = bodyModel || DEFAULT_MODEL;
  if (!isAllowedModel(model)) return bad("invalid model", 400);

  // Files (text or PDF) are extracted to plain text and folded straight into
  // the prompt so every model handles them the same way, no vision API
  // needed. The visible/stored message stays just what the user typed, see
  // storedMessage below.
  const fileBlock = files?.length
    ? `${(await Promise.all(files.map(decodeFile))).join("\n\n")}\n\n`
    : "";
  const messageText = fileBlock + (message || "");

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
  const tools = [
    ...(codeExecConfigured() ? [RUN_PYTHON_TOOL] : []),
    ...(searchConfigured() ? [WEB_SEARCH_TOOL] : []),
    ...(imageConfigured() ? [GENERATE_IMAGE_TOOL] : []),
    FETCH_URL_TOOL, // no third-party key needed, always available
  ];
  const wantsTools = tools.length > 0 && appendUser;
  const base = worstCaseCredits(model, promptParts.join("\n"));
  // Worst case is MAX_TOOL_ROUNDS + 1 full completion calls (each tool round
  // triggers one more), plus the single priciest tool surcharge per round.
  // Summing every tool's cost together assumed the model fires code, search,
  // AND image generation all in the same round, which never happens in
  // practice and made the reservation unusably large once image generation
  // was configured (it alone dwarfs the others). Settle refunds whatever
  // wasn't actually needed either way. fetch_url has no surcharge, it costs
  // velum nothing beyond ordinary bandwidth.
  const maxToolCost = Math.max(
    codeExecConfigured() ? codeCredits() : 0,
    searchConfigured() ? searchCredits() : 0,
    imageConfigured() ? imageCredits() : 0,
  );
  const r = await reserveCredits(
    account,
    wantsTools
      ? base * (MAX_TOOL_ROUNDS + 1) + maxToolCost * MAX_TOOL_ROUNDS
      : base,
  );
  if (!r.ok) return bad("not enough credits", 402);

  const userContent = images?.length
    ? [
        ...(messageText ? [{ type: "text", text: messageText }] : []),
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : messageText;

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history,
    ...(appendUser ? [{ role: "user", content: userContent }] : []),
  ];

  const maxOutput = outputCapFor(length);
  let usingTools = wantsTools;
  let upstream;
  try {
    upstream = await streamChat({
      model,
      messages,
      tools: usingTools ? tools : undefined,
      maxOutput,
      signal: req.signal,
    });
  } catch (err) {
    logError("upstream_request_failed", err, { model });
    await settleCredits(r.reservationId, 0);
    return bad("upstream request failed", 502);
  }

  // Some models on OpenRouter have no endpoint that supports tool use at
  // all, and 404 the whole request rather than just ignoring the tool.
  // Degrade to a normal, tools-off request instead of failing the chat.
  if (!upstream.ok && usingTools) {
    const detail = await upstream.text().catch(() => "");
    if (/tool use|tool_use|tool compatibility/i.test(detail)) {
      usingTools = false;
      try {
        upstream = await streamChat({ model, messages, maxOutput, signal: req.signal });
      } catch (err) {
        logError("upstream_request_failed", err, { model });
        await settleCredits(r.reservationId, 0);
        return bad("upstream request failed", 502);
      }
    } else {
      logError("upstream_api_error", new Error(detail || `status ${upstream.status}`), {
        status: upstream.status,
        model,
      });
      await settleCredits(r.reservationId, 0);
      return bad("the model provider had an error, try again", 502);
    }
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

  const storedMessage = [
    message,
    images?.length ? `[${images.length} image${images.length > 1 ? "s" : ""}]` : "",
    files?.length ? `[${files.map((f) => f.name).join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return exchangeResponse({
    account,
    reservationId: r.reservationId,
    chatId,
    model,
    promptText: promptParts.join("\n"),
    storedMessage,
    images,
    files,
    events: usingTools
      ? toolLoopEvents({
          firstEvents: chatEvents(upstream.body),
          model,
          messages,
          tools,
          maxOutput,
          signal: req.signal,
        })
      : chatEvents(upstream.body),
    appendUser,
    ephemeral: !!ephemeral,
  });
}
