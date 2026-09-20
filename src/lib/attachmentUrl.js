import { signId } from "@/lib/sign";

// Attach a short signed URL to every stored image on a loaded chat so the
// browser can fetch it without sending the account number.
export function decorateChatAttachments(chat) {
  if (!chat) return chat;
  return {
    ...chat,
    messages: chat.messages.map((m) => ({
      ...m,
      attachments: m.attachments.map((a) => ({
        ...a,
        url: `/api/attachments/${a.id}?t=${signId(a.id)}`,
      })),
    })),
  };
}
