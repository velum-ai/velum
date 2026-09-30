import { NextResponse } from "next/server";
import {
  renameChat,
  setChatPinned,
  setChatShared,
  setChatProject,
  deleteChat,
  getChat,
} from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { decorateChatAttachments } from "@/lib/attachmentUrl";

const LIMITS = { key: "chats", limit: 60, windowMs: 60_000 };

const json = (data) => NextResponse.json(data);

async function guarded(req) {
  const body = await req.json().catch(() => ({}));
  const g = await guardRequest(req, { ...LIMITS, account: body.account });
  return { body, g };
}

// Load one thread's messages (the lookup payload omits them).
export async function POST(req) {
  const { body, g } = await guarded(req);
  if (g.error) return bad(g.error, g.status);

  const chat = await getChat(body.account, body.chatId);
  return chat ? json(decorateChatAttachments(chat)) : bad("invalid request", 400);
}

export async function PATCH(req) {
  const { body, g } = await guarded(req);
  if (g.error) return bad(g.error, g.status);

  const result =
    typeof body.pinned === "boolean"
      ? await setChatPinned(body.account, body.chatId, body.pinned)
      : typeof body.shared === "boolean"
        ? await setChatShared(body.account, body.chatId, body.shared)
        : "projectId" in body
          ? await setChatProject(body.account, body.chatId, body.projectId)
          : await renameChat(body.account, body.chatId, body.title);
  return result ? json(result) : bad("invalid request", 400);
}

export async function DELETE(req) {
  const { body, g } = await guarded(req);
  if (g.error) return bad(g.error, g.status);

  const ok = await deleteChat(body.account, body.chatId);
  return ok ? json({ ok: true }) : bad("invalid request", 400);
}
