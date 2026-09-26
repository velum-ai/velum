import { finalizeExchange, settleCredits } from "@/lib/account";
import {
  usageToCredits,
  estimateInputTokens,
  codeCredits,
  searchCredits,
  imageCredits,
} from "@/lib/pricing";

// fetch_url has no entry - it costs velum nothing beyond ordinary bandwidth.
const TOOL_CREDITS = {
  run_python: codeCredits,
  web_search: searchCredits,
  generate_image: imageCredits,
};
import { saveAttachment } from "@/lib/storage";
import { signId } from "@/lib/sign";
import { logError } from "@/lib/logger";

// The money path of one exchange, as an SSE Response. Forwards delta / reasoning
// chunks to the client, then settles the reservation (real usage, or a char
// estimate on abort). A normal exchange also persists in one transaction and
// stores any uploaded images; an `ephemeral` one settles only and writes
// nothing.
//
// If the process dies here, the reservation stays PENDING and the maintenance
// sweep refunds it, so no credits are lost.

const IMAGE_DATA_URL = /^data:(image\/[a-z+.-]+);base64,(.+)$/i;
const FILE_DATA_URL = /^data:(text\/plain|text\/markdown|application\/pdf);base64,(.+)$/i;

async function persistUploads({ images, files, accountId, chatId, messageId }) {
  for (const url of images || []) {
    const m = IMAGE_DATA_URL.exec(url);
    if (!m) continue;
    try {
      await saveAttachment({
        accountId,
        chatId,
        messageId,
        kind: "upload",
        mime: m[1].toLowerCase(),
        buffer: Buffer.from(m[2], "base64"),
      });
    } catch (e) {
      logError("attachment_save_failed", e, { chatId });
    }
  }
  for (const f of files || []) {
    const m = FILE_DATA_URL.exec(f?.url || "");
    if (!m) continue;
    try {
      await saveAttachment({
        accountId,
        chatId,
        messageId,
        kind: "upload",
        mime: m[1].toLowerCase(),
        buffer: Buffer.from(m[2], "base64"),
      });
    } catch (e) {
      logError("attachment_save_failed", e, { chatId });
    }
  }
}

export function exchangeResponse({
  account,
  reservationId,
  chatId,
  model,
  promptText,
  storedMessage,
  images,
  files,
  events,
  appendUser = true,
  ephemeral = false,
}) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // client gone - settlement still runs below
        }
      };

      let reply = "";
      let reasoning = "";
      let usage = null;
      let toolSurcharge = 0;
      const toolFiles = [];
      try {
        for await (const ev of events) {
          if (ev.usage) usage = ev.usage;
          // billed per actual call, not deduped - the same tool can run
          // (and cost real provider money) more than once in one exchange
          if (ev.toolBilled) toolSurcharge += TOOL_CREDITS[ev.toolBilled]?.() || 0;
          if (ev.toolFile) toolFiles.push(ev.toolFile);
          if (ev.error) send({ error: ev.error });
          if (ev.toolStart) send({ toolStart: ev.toolStart });
          if (ev.toolEnd) send({ toolEnd: ev.toolEnd });
          if (ev.reasoning) {
            reasoning += ev.reasoning;
            send({ reasoning: ev.reasoning });
          }
          if (ev.delta) {
            reply += ev.delta;
            send({ delta: ev.delta });
          }
        }
      } catch {
        // aborted or upstream dropped - settle from what we have
      }

      const actual =
        usageToCredits(
          model,
          usage ?? {
            prompt_tokens: estimateInputTokens(promptText),
            completion_tokens: estimateInputTokens(reply),
          },
        ) + toolSurcharge;

      if (ephemeral) {
        const balance = await settleCredits(reservationId, actual);
        send({ done: true, credits: balance, cost: actual, ephemeral: true });
      } else {
        const result = await finalizeExchange({
          reservationId,
          actual,
          model,
          reasoning,
          accountId: account,
          chatId,
          userContent: storedMessage,
          replyContent: reply,
          appendUser,
        });
        if (
          appendUser &&
          (images?.length || files?.length) &&
          result.userMessageId
        ) {
          await persistUploads({
            images,
            files,
            accountId: account,
            chatId: result.chatId,
            messageId: result.userMessageId,
          });
        }
        const attachments = [];
        for (const f of toolFiles) {
          try {
            const at = await saveAttachment({
              accountId: account,
              chatId: result.chatId,
              messageId: result.assistantMessageId,
              kind: "generated",
              mime: f.mime,
              buffer: f.buffer,
            });
            attachments.push({
              id: at.id,
              mime: at.mime,
              name: f.name,
              url: `/api/attachments/${at.id}?t=${signId(at.id)}`,
            });
          } catch (e) {
            logError("attachment_save_failed", e, { chatId: result.chatId });
          }
        }
        send({
          done: true,
          credits: result.balance,
          cost: actual,
          chatId: result.chatId,
          title: result.title,
          spent: result.spent,
          messageId: result.assistantMessageId,
          userMessageId: result.userMessageId,
          attachments,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
