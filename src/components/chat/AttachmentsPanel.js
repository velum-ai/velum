"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, FileIcon, DownloadIcon, PaperclipIcon } from "@/components/chat/icons";
import Lightbox from "@/components/chat/Lightbox";

function attachmentsOf(messages) {
  const images = [];
  const files = [];
  for (const msg of messages) {
    for (const a of msg.attachments || []) {
      if (!a.mime || a.mime.startsWith("image/")) images.push({ src: a.url, name: a.name || `${a.id}` });
      else files.push(a);
    }
  }
  return { images, files };
}

// Every image and file attached or generated anywhere in the current chat,
// in one place - opened from the paperclip button in ChatHeader. Images open
// in the existing Lightbox; files just link out to a real download, same as
// the inline file chip in MessageList.
export default function AttachmentsPanel({ open, messages, onClose }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const { images, files } = useMemo(() => attachmentsOf(messages), [messages]);

  if (!open || typeof document === "undefined") return null;

  const empty = !images.length && !files.length;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
        onClick={onClose}
      >
        <div
          className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <span className="text-faint">
              <PaperclipIcon />
            </span>
            <span className="flex-1 font-chat text-sm text-foreground">attachments</span>
            <button
              onClick={onClose}
              title="close"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {empty ? (
              <p className="py-6 text-center font-chat text-sm text-faint">
                no attachments in this chat yet
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxIndex(i)}
                        className="aspect-square overflow-hidden rounded-md border border-border"
                        title={img.name}
                      >
                        <img src={img.src} alt={img.name} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {files.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        download={f.name}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 font-chat text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <span className="shrink-0 text-faint">
                          <FileIcon />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-faint">
                          <DownloadIcon />
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxIndex != null && (
        <Lightbox
          items={images}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>,
    document.body,
  );
}
