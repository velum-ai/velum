"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CloseIcon,
  FileIcon,
  DownloadIcon,
  ExpandIcon,
  CollapseIcon,
} from "@/components/chat/icons";
import PdfViewer from "@/components/chat/PdfViewer";
import CodeViewer from "@/components/chat/CodeViewer";

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 416; // 26rem

// Side panel for a document a tool generated (PDF, csv, txt...). Opens the
// moment the model commits to an output_file (status "generating"), fills
// in with a real preview once the file actually lands (status "ready").
// Images never come through here, they render inline in the chat instead.
// Desktop: a resizable sibling in the flex layout, pushing the chat
// narrower, with a fullscreen toggle. Mobile: always a full-screen overlay,
// there's no room to spare beside the chat.
export default function DocPanel({ doc, onClose }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);

  if (!doc) return null;

  const startResize = (e) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev) => {
      // panel sits on the right, dragging left widens it
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth - (ev.clientX - startX)));
      setWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const body = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="shrink-0 text-faint">
          <FileIcon />
        </span>
        <span className="min-w-0 flex-1 truncate font-chat text-sm text-foreground">
          {doc.name}
        </span>
        {doc.status === "ready" && (
          <a
            href={doc.url}
            download={doc.name}
            title={`download ${doc.name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <DownloadIcon />
          </a>
        )}
        <button
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "exit fullscreen" : "fullscreen"}
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:grid"
        >
          {fullscreen ? <CollapseIcon /> : <ExpandIcon />}
        </button>
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
          <div style={{ pointerEvents: dragging ? "none" : "auto", height: "100%" }}>
            {doc.mime === "application/pdf" ? (
              <PdfViewer url={doc.url} name={doc.name} />
            ) : (
              <CodeViewer url={doc.url} name={doc.name} />
            )}
          </div>
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
    </>
  );

  return (
    <>
      <aside
        style={{ width: fullscreen ? undefined : width }}
        className={`relative hidden shrink-0 flex-col border-l border-border ${
          fullscreen ? "" : "md:flex"
        }`}
      >
        {!fullscreen && (
          <div
            onMouseDown={startResize}
            title="drag to resize"
            className="absolute inset-y-0 -left-0.5 z-10 hidden w-1 cursor-col-resize md:block hover:bg-border-strong"
          />
        )}
        {body}
      </aside>

      {createPortal(
        <div
          className={`fixed inset-0 z-[70] flex-col bg-background ${
            fullscreen ? "flex" : "flex md:hidden"
          }`}
        >
          {body}
        </div>,
        document.body,
      )}
    </>
  );
}
