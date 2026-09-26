"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { MODEL_LABELS } from "@/lib/pricing";
import {
  CopyIcon,
  CheckIcon,
  ArrowDownIcon,
  RefreshIcon,
  EditIcon,
  FileIcon,
  DownloadIcon,
} from "@/components/chat/icons";
import ThinkingPanel from "@/components/chat/ThinkingPanel";
import ActivityPanel from "@/components/chat/ActivityPanel";
import Lightbox from "@/components/chat/Lightbox";

const SUGGESTIONS = [
  "explain a hard concept simply",
  "draft a polite but firm email",
  "find the bug in this snippet",
  "plan my week around 3 priorities",
];

function IconButton({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-7 w-7 place-items-center rounded-md text-faint opacity-100 transition hover:bg-surface-2 hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
    >
      {children}
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      title={copied ? "copied" : "copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </IconButton>
  );
}

function imagesOf(msg) {
  if (msg.attachments?.length) {
    return msg.attachments
      .filter((a) => !a.mime || a.mime.startsWith("image/"))
      .map((a) => ({ src: a.url, name: `${a.id}` }));
  }
  if (msg.images?.length) return msg.images.map((src) => ({ src, name: "image" }));
  if (msg.image) return [{ src: msg.image, name: "image" }];
  return [];
}

// Non-image attachments (a PDF/csv/etc a tool generated) - a real download,
// not something to render inline.
function filesOf(msg) {
  return (msg.attachments || []).filter((a) => a.mime && !a.mime.startsWith("image/"));
}

function MessageRow({
  msg,
  isUser,
  isLast,
  streaming,
  generating,
  onRegenerate,
  onEdit,
  onRetry,
  onZoom,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const html = useMemo(
    () => (isUser ? null : renderMarkdown(msg.content)),
    [isUser, msg.content],
  );
  const pics = imagesOf(msg);
  const files = filesOf(msg);
  const modelLabel = MODEL_LABELS[msg.model] || msg.model;

  return (
    <div
      className={`group flex flex-col gap-1.5 ${
        isUser ? "items-end" : "items-start"
      } ${isLast ? "animate-in" : ""}`}
    >
      <span className="px-1 text-[11px] uppercase tracking-[0.14em] text-faint">
        {isUser ? "you" : "velum"}
      </span>

      {pics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pics.map((p, j) => (
            // eslint-disable-next-line @next/next/no-img-element -- stored / data image
            <img
              key={j}
              src={p.src}
              alt="attachment"
              onClick={() => onZoom(pics, j)}
              className="max-h-60 max-w-[18rem] cursor-zoom-in rounded-md border border-border object-cover"
            />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <a
              key={f.id}
              href={f.url}
              download={f.name}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <FileIcon />
              {f.name || "file"}
              <DownloadIcon />
            </a>
          ))}
        </div>
      )}

      {!isUser && <ActivityPanel activity={msg.activity} />}

      {!isUser && (streaming || msg.reasoning) && (
        <ThinkingPanel
          reasoning={msg.reasoning || ""}
          startedAt={msg.startedAt}
          streaming={streaming}
          toolRunning={msg.activity?.some((a) => a.status === "running")}
        />
      )}

      {generating ? (
        <div className="px-1 py-1 font-chat text-sm text-faint">
          generating image…
        </div>
      ) : editing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(10, draft.split("\n").length + 1)}
            autoFocus
            className="w-full resize-none rounded-md border border-border-strong bg-surface px-4 py-2.5 font-chat text-[15px] leading-7 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setDraft(msg.content);
                setEditing(false);
              }}
              className="rounded-md px-2.5 py-1 font-chat text-xs text-muted hover:text-foreground"
            >
              cancel
            </button>
            <button
              onClick={() => {
                setEditing(false);
                if (draft.trim() && draft !== msg.content) onEdit(draft.trim());
              }}
              className="rounded-md border border-border-strong bg-surface-2 px-2.5 py-1 font-chat text-xs text-foreground hover:border-foreground"
            >
              send
            </button>
          </div>
        </div>
      ) : msg.error ? (
        <p className="font-chat text-sm italic text-muted">{msg.content}</p>
      ) : msg.content ? (
        isUser ? (
          <div className="max-w-[85%] whitespace-pre-wrap rounded-md border border-border bg-surface px-4 py-2.5 font-chat text-[15px] leading-7">
            {msg.content}
          </div>
        ) : (
          <div
            className="md-prose w-full max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      ) : null}

      {!streaming && !editing && !generating && (
        <div className="flex min-h-[1.75rem] items-center gap-1 px-1">
          {isUser ? (
            <>
              <CopyButton text={msg.content} />
              {onEdit && (
                <IconButton title="edit" onClick={() => setEditing(true)}>
                  <EditIcon />
                </IconButton>
              )}
            </>
          ) : msg.error ? (
            onRetry && (
              <IconButton title="retry" onClick={onRetry}>
                <RefreshIcon />
              </IconButton>
            )
          ) : (
            msg.content && (
              <>
                {(msg.cost || modelLabel) && (
                  <span className="mr-0.5 text-[11px] tabular-nums text-faint">
                    {[modelLabel, msg.cost ? `${msg.cost} cr` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <CopyButton text={msg.content} />
                {onRegenerate && (
                  <IconButton title="regenerate" onClick={onRegenerate}>
                    <RefreshIcon />
                  </IconButton>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

const SKELETON_TURNS = [
  { me: true, lines: ["46%"] },
  { me: false, lines: ["96%", "88%", "93%", "54%"] },
  { me: true, lines: ["38%"] },
  { me: false, lines: ["91%", "97%", "72%"] },
];

function MessageSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {SKELETON_TURNS.map((t, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2 ${t.me ? "items-end" : "items-start"}`}
          >
            <div className="sk h-2.5 w-9" />
            {t.me ? (
              <div
                className="sk h-11 rounded-md"
                style={{ width: t.lines[0] }}
              />
            ) : (
              <div className="flex w-full flex-col gap-2.5">
                {t.lines.map((w, j) => (
                  <div key={j} className="sk h-3.5" style={{ width: w }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MessageList({
  messages,
  sending,
  loading,
  ephemeral,
  activeChatId,
  onPickSuggestion,
  onRegenerate,
  onEditMessage,
  onRetryFailed,
}) {
  const scrollRef = useRef(null);
  const stick = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [zoom, setZoom] = useState(null); // { items, index }

  const toBottom = (behavior = "smooth") =>
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior,
    });

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = dist < 80;
    setShowJump(dist > 240);
  };

  useEffect(() => {
    // Instant, not smooth, while a reply is streaming: a token can land every
    // few ms, and overlapping smooth-scroll animations fight the user's own
    // scroll input, making it feel impossible to scroll up mid-reply.
    if (stick.current) toBottom(sending || messages.length <= 2 ? "auto" : "smooth");
  }, [messages, sending]);

  useEffect(() => {
    stick.current = true;
    toBottom("auto");
  }, [activeChatId]);

  // one delegated handler for every code-block copy button
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onClick = async (e) => {
      const btn = e.target.closest(".md-copy");
      if (!btn || btn.dataset.busy) return;
      const pre = btn.closest(".md-cb")?.querySelector("pre");
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.innerText);
      } catch {
        return;
      }
      btn.dataset.busy = "1";
      const original = btn.textContent;
      btn.textContent = "copied";
      setTimeout(() => {
        btn.textContent = original;
        delete btn.dataset.busy;
      }, 1500);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  if (loading && messages.length === 0) return <MessageSkeleton />;

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-5 pb-[12vh] text-center">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-chat text-2xl font-medium tracking-tight">
              {ephemeral ? "temporary chat" : "what can i help with?"}
            </h1>
            <p className="font-chat text-sm text-muted">
              {ephemeral
                ? "this chat is not saved and won't appear in your history."
                : "not linked to any identity."}
            </p>
          </div>
          {!ephemeral && (
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onPickSuggestion?.(s)}
                  className="rounded-md border border-border bg-surface px-3.5 py-2.5 text-left font-chat text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <p className="font-chat text-[11px] text-faint">
            press <kbd className="font-mono text-foreground">?</kbd> for shortcuts
          </p>
        </div>
      </div>
    );
  }

  const lastAssistant = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {ephemeral && (
            <p className="mx-auto rounded-md border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-faint">
              temporary chat, not saved
            </p>
          )}
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isLast = i === messages.length - 1;
            const streaming =
              sending && isLast && msg.role === "assistant" && !msg.generating;

            return (
              <MessageRow
                key={msg.id ?? (isLast ? "live" : i)}
                msg={msg}
                isUser={isUser}
                isLast={isLast}
                streaming={streaming}
                generating={!!msg.generating}
                onZoom={(items, index) => setZoom({ items, index })}
                onRegenerate={
                  !sending && i === lastAssistant && onRegenerate
                    ? () => onRegenerate(i)
                    : null
                }
                onEdit={
                  !sending && isUser && onEditMessage
                    ? (text) => onEditMessage(i, text)
                    : null
                }
                onRetry={
                  !sending && msg.error && onRetryFailed
                    ? () => onRetryFailed(i)
                    : null
                }
              />
            );
          })}
        </div>
      </div>

      {showJump && (
        <button
          onClick={() => {
            stick.current = true;
            toBottom("smooth");
          }}
          title="scroll to latest"
          className="absolute bottom-4 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-md border border-border bg-surface text-muted shadow-lg transition-colors hover:text-foreground"
        >
          <ArrowDownIcon />
        </button>
      )}

      {zoom && (
        <Lightbox
          items={zoom.items}
          index={zoom.index}
          onIndex={(index) => setZoom((z) => ({ ...z, index }))}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
