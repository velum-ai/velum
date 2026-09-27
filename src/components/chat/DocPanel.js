"use client";

import { createPortal } from "react-dom";
import { CloseIcon, FileIcon, DownloadIcon } from "@/components/chat/icons";

// Side panel for a document a tool generated (PDF, csv, txt...). Opens the
// moment the model commits to an output_file (status "generating"), fills
// in with a real preview once the file actually lands (status "ready").
// Images never come through here, they render inline in the chat instead.
// Desktop: a real sibling in the flex layout, pushing the chat narrower.
// Mobile: a full-screen overlay, there's no room to spare beside the chat.
export default function DocPanel({ doc, onClose }) {
  if (!doc) return null;

  const body = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="shrink-0 text-faint">
          <FileIcon />
        </span>
        <span className="min-w-0 flex-1 truncate font-chat text-sm text-foreground">
          {doc.name}
        </span>
        <button
          onClick={onClose}
          title="close"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-surface">
        {doc.status === "ready" ? (
          <iframe src={doc.url} title={doc.name} className="h-full w-full border-0" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="thinking">
              <span />
              <span />
              <span />
            </span>
            <p className="font-chat text-sm text-muted">writing {doc.name}…</p>
          </div>
        )}
      </div>

      {doc.status === "ready" && (
        <div className="shrink-0 border-t border-border p-3">
          <a
            href={doc.url}
            download={doc.name}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-foreground"
          >
            <DownloadIcon />
            download {doc.name}
          </a>
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className="hidden w-[26rem] shrink-0 flex-col border-l border-border md:flex">
        {body}
      </aside>

      {createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col bg-background md:hidden">
          {body}
        </div>,
        document.body,
      )}
    </>
  );
}
