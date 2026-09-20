import { finalizeExchange, settleCredits } from "@/lib/account";
import { usageToCredits, estimateInputTokens } from "@/lib/pricing";
import { saveAttachment } from "@/lib/storage";
import { logError } from "@/lib/logger";

// The money path of one exchange, as an SSE Response. Forwards delta / reasoning
// chunks to the client, then settles the reservation (real usage, or a char
// estimate on abort). A normal exchange also persists in one transaction and
// stores any uploaded images; an `ephemeral` one settles only and writes
// nothing.
//
// If the process dies here, the reservation stays PENDING and the maintenance
// sweep refunds it, so no credits are lost.

const DATA_URL = /^data:(image\/[a-z+.-]+);base64,(.+)$/i;

async function persistUploads({ images, accountId, chatId, messageId }) {
  for (const url of images || []) {
    const m = DATA_URL.exec(url);
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
      try {
        for await (const ev of events) {
          if (ev.usage) usage = ev.usage;
          if (ev.error) send({ error: ev.error });
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

      const actual = usageToCredits(
        model,
        usage ?? {
          prompt_tokens: estimateInputTokens(promptText),
          completion_tokens: estimateInputTokens(reply),
        },
      );

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
        if (appendUser && images?.length && result.userMessageId) {
          await persistUploads({
            images,
            accountId: account,
            chatId: result.chatId,
            messageId: result.userMessageId,
          });
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
