import { NextResponse } from "next/server";
import { listChats, listProjects, getChat } from "@/lib/account";
import { guardRequest } from "@/lib/guard";
import { decorateChatAttachments } from "@/lib/attachmentUrl";

// One-shot bootstrap for the chat app: balance, the chat list, and - when a
// `chatId` is supplied (the client's last-open thread) - that thread's full
// messages, so the UI can render the real conversation on first paint instead
// of flashing an empty screen and then swapping.
export async function POST(req) {
  const { account, chatId } = await req.json().catch(() => ({}));
  const g = await guardRequest(req, {
    key: "lookup-account",
    limit: 20,
    windowMs: 5 * 60_000,
    busy: "too many attempts, try again later",
    account,
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const [chats, projects, chat] = await Promise.all([
    listChats(account),
    listProjects(account),
    chatId ? getChat(account, chatId) : null,
  ]);

  return NextResponse.json({
    account,
    credits: g.record.credits,
    chats,
    projects,
    chat: decorateChatAttachments(chat),
  });
}
