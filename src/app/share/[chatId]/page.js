import Link from "next/link";
import ReactMarkdown from "react-markdown";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSharedChat } from "@/lib/account";
import { decorateChatAttachments } from "@/lib/attachmentUrl";
import { remarkPlugins, rehypePlugins, preprocessMath } from "@/lib/markdownPlugins";

export const metadata = { title: "shared chat" };

// No copy-button chrome here (unlike MessageList's richer `pre` override) -
// this is a plain server component with no client-side interactivity at
// all, and the old renderer's version of this button never actually worked
// here either (its click handler lived only in MessageList.js's own
// client-side effect, never wired up on this page).
function SharedPre({ children }) {
  return <pre className="md-pre">{children}</pre>;
}
const sharedMarkdownComponents = { pre: SharedPre };

function Bubble({ msg }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      <span className="px-1 text-[11px] uppercase tracking-[0.14em] text-faint">
        {isUser ? "user" : "velum"}
      </span>

      {msg.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {msg.attachments.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element -- signed attachment url
            <img
              key={a.id}
              src={a.url}
              alt="attachment"
              className="max-h-60 max-w-[18rem] rounded-md border border-border object-cover"
            />
          ))}
        </div>
      )}

      {isUser ? (
        <div className="max-w-[85%] whitespace-pre-wrap rounded-md border border-border bg-surface px-4 py-2.5 font-chat text-[15px] leading-7">
          {msg.content}
        </div>
      ) : (
        <div className="md-prose w-full max-w-none">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={sharedMarkdownComponents}
          >
            {preprocessMath(msg.content)}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default async function SharedChatPage({ params }) {
  const { chatId } = await params;
  const chat = await getSharedChat(chatId).then((c) => c && decorateChatAttachments(c));

  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        {chat ? (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.12em] text-faint">
                shared chat
              </p>
              <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
                {chat.title}
              </h1>
            </div>

            <div className="flex flex-col gap-6 border-t border-border pt-6">
              {chat.messages.map((msg) => (
                <Bubble key={msg.id} msg={msg} />
              ))}
            </div>

            <div className="flex flex-col items-start gap-2 border-t border-border pt-6">
              <p className="text-sm text-muted">read-only, from velum</p>
              <Link
                href="/create-account"
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-background hover:text-foreground"
              >
                start your own chat
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-medium tracking-tight">not found</h1>
            <p className="text-sm text-muted">
              this chat doesn&apos;t exist, or is no longer shared.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
