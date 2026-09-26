import { getSharedChat } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { decorateChatAttachments } from "@/lib/attachmentUrl";

// Public, read-only: no account, gated entirely on the chat's own
// shared=true flag. Rate limited by IP since there's no account to key on.
export async function GET(req, { params }) {
  const { chatId } = await params;

  const g = await guardRequest(req, { key: "share", limit: 60, windowMs: 60_000 });
  if (g.error) return bad(g.error, g.status);

  const chat = await getSharedChat(chatId);
  return chat ? Response.json(decorateChatAttachments(chat)) : bad("not found", 404);
}
