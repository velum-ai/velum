import { randomInt } from "node:crypto";
import { prisma, TX_OPTS } from "@/lib/prisma";
import { IMAGE_MODEL, isAllowedModel, defaultModelIds } from "@/lib/pricing";
import { dodoConfigured } from "@/lib/dodo";
import { btcpayConfigured } from "@/lib/btcpay";
import { encryptText, decryptText } from "@/lib/crypto";
import { logError } from "@/lib/logger";
import {
  deleteAttachmentFilesForChats,
  deleteAttachmentFilesForAccount,
} from "@/lib/storage";

// Message.content/reasoning, Chat.title, and Account.systemPrompt are
// encrypted at rest (see crypto.js). Every write below encrypts before
// insert; every read decrypts through safeDecrypt, so callers outside this
// module only ever see plaintext. decryptText throws on a row it can't
// decrypt (wrong key, corrupted data); one bad row degrades to a placeholder
// instead of 500ing the whole request.
function safeDecrypt(value) {
  if (value == null) return value;
  try {
    return decryptText(value);
  } catch (err) {
    logError("decrypt_failed", err);
    return "[unable to decrypt]";
  }
}

const decMessage = (m) =>
  m && { ...m, content: safeDecrypt(m.content), reasoning: safeDecrypt(m.reasoning) };
const decChat = (c) => c && { ...c, title: safeDecrypt(c.title) };

const GROUPS = 4;
const TITLE_MAX = 40;
const SYSTEM_PROMPT_MAX = 2000;
const ACCOUNT_RE = /^(\d{4} ){3}\d{4}$/;

// New accounts start empty (pay-upfront model). Set SIGNUP_CREDITS to grant a
// trial balance instead.
const STARTING_CREDITS = (() => {
  const n = Number(process.env.SIGNUP_CREDITS);
  return Number.isInteger(n) && n >= 0 ? n : 0;
})();

const randomAccountNumber = () =>
  Array.from({ length: GROUPS }, () => randomInt(1000, 10_000)).join(" ");

const titleFrom = (text) => {
  const t = String(text ?? "").trim();
  if (!t) return "new chat";
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX)}…` : t;
};

export const isValidAccountFormat = (s) => ACCOUNT_RE.test(String(s ?? ""));

export async function createAccount() {
  for (;;) {
    try {
      const { number } = await prisma.account.create({
        data: { number: randomAccountNumber(), credits: STARTING_CREDITS },
        select: { number: true },
      });
      return number;
    } catch (err) {
      if (err.code !== "P2002") throw err; // retry only on id collision
    }
  }
}

// Bad format -> null (no query). Lightweight record only; chats are separate.
export async function findAccount(number) {
  if (!isValidAccountFormat(number)) return null;
  const acc = await prisma.account.findUnique({
    where: { number },
    select: { number: true, credits: true, systemPrompt: true, createdAt: true, enabledModels: true },
  });
  return acc && { ...acc, systemPrompt: safeDecrypt(acc.systemPrompt) };
}

export async function listChats(number) {
  const chats = await prisma.chat.findMany({
    where: { accountId: number },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, spent: true, pinned: true },
  });
  return chats.map(decChat);
}

const MESSAGE_SELECT = {
  id: true,
  role: true,
  content: true,
  model: true,
  cost: true,
  reasoning: true,
  attachments: {
    select: { id: true, mime: true, width: true, height: true },
  },
};

// Full thread, scoped to the owning account. Unknown chat -> null.
export async function getChat(number, chatId) {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, accountId: number },
    select: {
      id: true,
      title: true,
      pinned: true,
      messages: { orderBy: { id: "asc" }, select: MESSAGE_SELECT },
    },
  });
  return chat && { ...decChat(chat), messages: chat.messages.map(decMessage) };
}

// Last `limit` messages of a chat, oldest-first, scoped to the account.
export async function getHistory(number, chatId, limit) {
  if (!chatId) return [];
  const rows = await prisma.message.findMany({
    where: { chatId, chat: { accountId: number } },
    orderBy: { id: "desc" },
    take: limit,
    select: { role: true, content: true },
  });
  return rows.reverse().map((m) => ({ ...m, content: safeDecrypt(m.content) }));
}

// Atomically hold `amount` credits and record the reservation. Short balance ->
// { ok: false, balance }. Otherwise { ok: true, balance, reservationId }.
export function reserveCredits(number, amount) {
  return prisma.$transaction(async (tx) => {
    // single conditional UPDATE - no lost-update race
    const { count } = await tx.account.updateMany({
      where: { number, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });

    const acc = await tx.account.findUnique({
      where: { number },
      select: { credits: true },
    });
    if (count === 0) return { ok: false, balance: acc?.credits ?? 0 };

    const { id } = await tx.reservation.create({
      data: { accountId: number, amount },
      select: { id: true },
    });
    return { ok: true, balance: acc.credits, reservationId: id };
  }, TX_OPTS);
}

// Close a reservation, refunding max(0, held - actual). Idempotent: a
// reservation that is not PENDING is left untouched. Returns the account's
// balance after settling (null if the reservation is unknown). Runs in a tx.
async function applySettle(tx, reservationId, actual) {
  const res = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { status: true, amount: true, accountId: true },
  });
  if (!res) return null;

  if (res.status === "PENDING") {
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "SETTLED", settledAt: new Date() },
    });
    const refund = Math.max(0, res.amount - actual);
    if (refund > 0) {
      await tx.account.update({
        where: { number: res.accountId },
        data: { credits: { increment: refund } },
      });
    }
  }

  const acc = await tx.account.findUnique({
    where: { number: res.accountId },
    select: { credits: true },
  });
  return acc?.credits ?? null;
}

export const settleCredits = (reservationId, actual) =>
  prisma.$transaction((tx) => applySettle(tx, reservationId, actual), TX_OPTS);

async function findOrCreateChat(tx, accountId, chatId, seedTitle) {
  const chat =
    (chatId &&
      (await tx.chat.findFirst({
        where: { id: chatId, accountId },
        select: { id: true, title: true },
      }))) ||
    (await tx.chat.create({
      data: { accountId, title: encryptText(titleFrom(seedTitle)) },
      select: { id: true, title: true },
    }));
  return decChat(chat);
}

// Settle the reservation AND persist the exchange in one transaction. Writes
// the assistant turn's model / cost / reasoning. `appendUser` is false on a
// regenerate (the user turn is already stored). Returns ids so the caller can
// attach uploaded images and anchor a later edit / regenerate.
export function finalizeExchange({
  reservationId,
  actual,
  model,
  reasoning,
  accountId,
  chatId,
  userContent,
  replyContent,
  appendUser = true,
}) {
  return prisma.$transaction(async (tx) => {
    await applySettle(tx, reservationId, actual);
    const chat = await findOrCreateChat(tx, accountId, chatId, userContent);

    let userMessageId = null;
    if (appendUser) {
      const um = await tx.message.create({
        data: { chatId: chat.id, role: "user", content: encryptText(String(userContent ?? "")) },
        select: { id: true },
      });
      userMessageId = um.id;
    }
    const am = await tx.message.create({
      data: {
        chatId: chat.id,
        role: "assistant",
        content: encryptText(String(replyContent ?? "")),
        model: model ?? null,
        cost: actual,
        reasoning: encryptText(reasoning || null),
      },
      select: { id: true },
    });

    const { spent } = await tx.chat.update({
      where: { id: chat.id },
      data: { spent: { increment: actual } },
      select: { spent: true },
    });
    const { credits } = await tx.account.findUnique({
      where: { number: accountId },
      select: { credits: true },
    });

    return {
      balance: credits,
      chatId: chat.id,
      title: chat.title,
      spent,
      userMessageId,
      assistantMessageId: am.id,
    };
  }, TX_OPTS);
}

// Settle + persist one image-generation turn (user prompt + assistant marker).
// The caller then saves the image as an Attachment on assistantMessageId.
export function finalizeImageExchange({
  reservationId,
  actual,
  accountId,
  chatId,
  prompt,
}) {
  return prisma.$transaction(async (tx) => {
    await applySettle(tx, reservationId, actual);
    const chat = await findOrCreateChat(tx, accountId, chatId, prompt);

    await tx.message.create({
      data: { chatId: chat.id, role: "user", content: encryptText(String(prompt ?? "")) },
    });
    const am = await tx.message.create({
      data: {
        chatId: chat.id,
        role: "assistant",
        content: encryptText("[generated an image]"),
        model: IMAGE_MODEL,
        cost: actual,
      },
      select: { id: true },
    });

    const { spent } = await tx.chat.update({
      where: { id: chat.id },
      data: { spent: { increment: actual } },
      select: { spent: true },
    });
    const { credits } = await tx.account.findUnique({
      where: { number: accountId },
      select: { credits: true },
    });

    return {
      balance: credits,
      chatId: chat.id,
      title: chat.title,
      spent,
      assistantMessageId: am.id,
    };
  }, TX_OPTS);
}

// Drop every message after `afterId` in a chat (edit / regenerate rewind).
// Scoped to the account; attachment rows cascade, their files are swept.
export async function truncateMessages(number, chatId, afterId) {
  const { count } = await prisma.message.deleteMany({
    where: { chatId, id: { gt: afterId }, chat: { accountId: number } },
  });
  return count;
}

export async function renameChat(number, chatId, title) {
  const clean = String(title ?? "").trim().slice(0, TITLE_MAX);
  if (!clean) return null;
  const { count } = await prisma.chat.updateMany({
    where: { id: chatId, accountId: number },
    data: { title: encryptText(clean) },
  });
  return count ? { id: chatId, title: clean } : null;
}

export async function setChatPinned(number, chatId, pinned) {
  const { count } = await prisma.chat.updateMany({
    where: { id: chatId, accountId: number },
    data: { pinned: Boolean(pinned) },
  });
  return count ? { id: chatId, pinned: Boolean(pinned) } : null;
}

export async function deleteChat(number, chatId) {
  await deleteAttachmentFilesForChats([chatId]);
  const { count } = await prisma.chat.deleteMany({
    where: { id: chatId, accountId: number },
  });
  return count > 0;
}

// --- account settings + data controls ----------------------------------

export async function updateSystemPrompt(number, text) {
  const clean = String(text ?? "").trim().slice(0, SYSTEM_PROMPT_MAX);
  const { count } = await prisma.account.updateMany({
    where: { number },
    data: { systemPrompt: encryptText(clean || null) },
  });
  return count ? { systemPrompt: clean || null } : null;
}

// The account's pickable model ids. No customization yet (empty array) ->
// the catalogue's defaults; otherwise the stored list, filtered to ids still
// in the catalogue (a model can be retired from pricing.js later).
export async function resolveEnabledModels(number) {
  const acc = await prisma.account.findUnique({
    where: { number },
    select: { enabledModels: true },
  });
  if (!acc) return null;
  if (acc.enabledModels.length === 0) return defaultModelIds();
  return acc.enabledModels.filter(isAllowedModel);
}

export async function updateEnabledModels(number, ids) {
  const clean = [...new Set(ids)].filter(isAllowedModel);
  if (clean.length === 0) return null; // must keep at least one model enabled
  const { count } = await prisma.account.updateMany({
    where: { number },
    data: { enabledModels: clean },
  });
  return count ? { enabledModels: clean } : null;
}

export async function wipeChats(number) {
  const chats = await prisma.chat.findMany({
    where: { accountId: number },
    select: { id: true },
  });
  await deleteAttachmentFilesForChats(chats.map((c) => c.id));
  const { count } = await prisma.chat.deleteMany({ where: { accountId: number } });
  return count;
}

export async function deleteAccount(number) {
  await deleteAttachmentFilesForAccount(number);
  await prisma.account.deleteMany({ where: { number } });
  return true;
}

// Full account dump for the "download my data" control. Chats oldest-first with
// every message; top-ups by amount and date. No personal data exists to include.
export async function exportAccount(number) {
  const acc = await prisma.account.findUnique({
    where: { number },
    select: { number: true, credits: true, systemPrompt: true, createdAt: true },
  });
  if (!acc) return null;

  const [chats, payments] = await Promise.all([
    prisma.chat.findMany({
      where: { accountId: number },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        pinned: true,
        createdAt: true,
        messages: {
          orderBy: { id: "asc" },
          select: {
            role: true,
            content: true,
            model: true,
            cost: true,
            reasoning: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { accountId: number, status: "PAID" },
      orderBy: { createdAt: "asc" },
      select: { amountCents: true, credits: true, createdAt: true, paidAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: { ...acc, systemPrompt: safeDecrypt(acc.systemPrompt) },
    chats: chats.map((c) => ({ ...decChat(c), messages: c.messages.map(decMessage) })),
    payments,
  };
}

const SEARCH_LIMIT = 20;
const SEARCH_BATCH = 500;
const SEARCH_MAX_SCAN = 5000; // bounds worst-case work on a huge history

// Case-insensitive substring search over the account's own message content.
// Content is encrypted at rest, so this can no longer be a SQL WHERE clause:
// it pages through the account's messages newest-first, decrypting each batch
// in memory, until it has enough matches or hits the scan cap.
export async function searchMessages(number, q) {
  const term = String(q ?? "").trim();
  if (term.length < 2) return [];
  const needle = term.toLowerCase();

  const results = [];
  let cursor;
  let scanned = 0;

  while (results.length < SEARCH_LIMIT && scanned < SEARCH_MAX_SCAN) {
    const rows = await prisma.message.findMany({
      where: { chat: { accountId: number } },
      orderBy: { id: "desc" },
      take: SEARCH_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, content: true, chatId: true, chat: { select: { title: true } } },
    });
    if (rows.length === 0) break;
    scanned += rows.length;
    cursor = rows[rows.length - 1].id;

    for (const m of rows) {
      const content = safeDecrypt(m.content);
      const i = content.toLowerCase().indexOf(needle);
      if (i === -1) continue;
      const start = Math.max(0, i - 40);
      const snippet =
        (start > 0 ? "…" : "") +
        content.slice(start, i + term.length + 60).replace(/\s+/g, " ").trim() +
        "…";
      results.push({ chatId: m.chatId, title: safeDecrypt(m.chat.title), messageId: m.id, snippet });
      if (results.length >= SEARCH_LIMIT) break;
    }
    if (rows.length < SEARCH_BATCH) break; // exhausted this account's messages
  }

  return results;
}

// Everything the account page shows: balance, age, custom instructions,
// lifetime totals, 30-day spend, spend by model, recent top-ups.
// `preloaded`, when the caller already has the account row (guardRequest's
// findAccount already fetched it for the rate-limit/auth check), skips a
// second identical lookup. Must be findAccount's shape: systemPrompt already
// decrypted, not raw ciphertext.
export async function accountOverview(number, preloaded) {
  const [acc, chats, msgAgg, byModel, payments, daily] = await Promise.all([
    preloaded
      ? Promise.resolve(preloaded)
      : prisma.account
          .findUnique({
            where: { number },
            select: { credits: true, createdAt: true, systemPrompt: true, enabledModels: true },
          })
          .then((a) => a && { ...a, systemPrompt: safeDecrypt(a.systemPrompt) }),
    prisma.chat.count({ where: { accountId: number } }),
    // cost is only ever set on assistant messages, so counting non-null cost
    // is the same as counting assistant messages - one query instead of two.
    prisma.message.aggregate({
      _sum: { cost: true },
      _count: { cost: true },
      where: { chat: { accountId: number } },
    }),
    prisma.message.groupBy({
      by: ["model"],
      _sum: { cost: true },
      where: { chat: { accountId: number }, model: { not: null } },
    }),
    prisma.payment.findMany({
      where: { accountId: number, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 20,
      select: { id: true, method: true, credits: true, amountCents: true, paidAt: true },
    }),
    prisma.$queryRaw`
      SELECT to_char(date_trunc('day', m."createdAt"), 'YYYY-MM-DD') AS d,
             COALESCE(SUM(m.cost), 0)::int AS cr
      FROM "Message" m JOIN "Chat" c ON c.id = m."chatId"
      WHERE c."accountId" = ${number}
        AND m."createdAt" > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1`,
  ]);

  if (!acc) return null;
  return {
    credits: acc.credits,
    createdAt: acc.createdAt,
    systemPrompt: acc.systemPrompt,
    stats: { chats, messages: msgAgg._count.cost, spent: msgAgg._sum.cost ?? 0 },
    byModel: byModel
      .map((r) => ({ model: r.model, spent: r._sum.cost ?? 0 }))
      .sort((a, b) => b.spent - a.spent),
    payments,
    daily,
    methods: { dodo: dodoConfigured(), btcpay: btcpayConfigured() },
    enabledModels: acc.enabledModels.length
      ? acc.enabledModels.filter(isAllowedModel)
      : defaultModelIds(),
  };
}

// --- top-ups (Dodo Payments card checkout, BTCPay Monero invoice) ----------

// `id` is generated by the caller so it can be handed to the provider (Dodo
// checkout metadata, or as part of the BTCPay redirect URL) before this row
// exists. Exactly one of dodoCheckoutId / btcpayInvoiceId is set, matching
// `method`.
export const createPayment = ({
  id,
  accountId,
  method = "DODO",
  dodoCheckoutId,
  btcpayInvoiceId,
  amountCents,
  credits,
}) =>
  prisma.payment.create({
    data: { id, accountId, method, dodoCheckoutId, btcpayInvoiceId, amountCents, credits },
    select: { id: true },
  });

export const failPayment = (id) =>
  prisma.payment.updateMany({
    where: { id, status: "CREATED" },
    data: { status: "FAILED" },
  });

// BTCPay's webhook and return-url redirect only carry the invoice id, not our
// ref, so look the Payment row up by it to recover the id creditPayment()
// expects.
export const paymentRefForInvoice = (btcpayInvoiceId) =>
  prisma.payment.findUnique({ where: { btcpayInvoiceId }, select: { id: true } });

// Mark a payment PAID and grant its credits - exactly once. The conditional
// updateMany + row lock means the return-url verify and the webhook can both
// call this and only the first credits the account. `expectAccount`, when
// given, refuses to act on a row that belongs to a different account (the
// verify path passes it; the signed webhook does not). Returns the resulting
// balance either way (null if the ref is unknown).
export function creditPayment({ ref, dodoPaymentId, expectAccount }) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({
      where: { id: ref },
      select: { id: true, accountId: true, credits: true },
    });
    if (!p) return { ok: false, balance: null };
    if (expectAccount && p.accountId !== expectAccount) {
      return { ok: false, balance: null };
    }

    const claimed = await tx.payment.updateMany({
      where: { id: p.id, status: { not: "PAID" } },
      data: { status: "PAID", dodoPaymentId, paidAt: new Date() },
    });

    if (claimed.count === 0) {
      const acc = await tx.account.findUnique({
        where: { number: p.accountId },
        select: { credits: true },
      });
      return { ok: true, credited: false, balance: acc?.credits ?? null };
    }

    const { credits } = await tx.account.update({
      where: { number: p.accountId },
      data: { credits: { increment: p.credits } },
      select: { credits: true },
    });
    return { ok: true, credited: true, balance: credits, granted: p.credits };
  }, TX_OPTS);
}
