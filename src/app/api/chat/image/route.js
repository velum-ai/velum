import { NextResponse } from "next/server";
import { reserveCredits, settleCredits, finalizeImageExchange } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateImage, imageConfigured } from "@/lib/upstream";
import { imageCredits } from "@/lib/pricing";
import { saveAttachment } from "@/lib/storage";
import { signId } from "@/lib/sign";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PROMPT_MAX = 4000;

// Image generation. Not streamed - a single JSON response after the image is
// ready. Billed at a flat per-image rate (see pricing.imageCredits).
export async function POST(req) {
  if (!imageConfigured()) return bad("image generation is not configured", 503);

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid request", 400);
  const { account, chatId, prompt, ephemeral } = body;

  const g = await guardRequest(req, {
    key: "image",
    limit: 8,
    windowMs: 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const perAccount = await checkRateLimit(`image-acct:${account}`, {
    limit: 12,
    windowMs: 60_000,
  });
  if (!perAccount.allowed) return bad("too many requests, try again later", 429);

  const text = typeof prompt === "string" ? prompt.trim().slice(0, PROMPT_MAX) : "";
  if (!text) return bad("invalid account", 400);

  const cost = imageCredits();
  const r = await reserveCredits(account, cost);
  if (!r.ok) return bad("not enough credits", 402);

  let image;
  try {
    image = await generateImage({ prompt: text, signal: req.signal });
  } catch (err) {
    logError("image_generation_failed", err, {});
    await settleCredits(r.reservationId, 0);
    return bad("image generation failed", 502);
  }

  if (ephemeral) {
    const balance = await settleCredits(r.reservationId, cost);
    return NextResponse.json({
      done: true,
      credits: balance,
      cost,
      ephemeral: true,
      image: `data:${image.mime};base64,${image.buffer.toString("base64")}`,
    });
  }

  try {
    const result = await finalizeImageExchange({
      reservationId: r.reservationId,
      actual: cost,
      accountId: account,
      chatId,
      prompt: text,
    });
    const at = await saveAttachment({
      accountId: account,
      chatId: result.chatId,
      messageId: result.assistantMessageId,
      kind: "generated",
      mime: image.mime,
      buffer: image.buffer,
    });
    return NextResponse.json({
      done: true,
      credits: result.balance,
      cost,
      chatId: result.chatId,
      title: result.title,
      spent: result.spent,
      messageId: result.assistantMessageId,
      attachment: {
        id: at.id,
        mime: at.mime,
        width: at.width,
        height: at.height,
        url: `/api/attachments/${at.id}?t=${signId(at.id)}`,
      },
    });
  } catch (err) {
    logError("image_persist_failed", err, {});
    return bad("could not save the image", 500);
  }
}
