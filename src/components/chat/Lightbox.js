"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, DownloadIcon, ArrowDownIcon } from "@/components/chat/icons";

// Full-screen image viewer. `items` is [{ src, name }]; navigable when there is
// more than one. Escape / backdrop / the close button all dismiss it.
export default function Lightbox({ items, index, onIndex, onClose }) {
  const many = items.length > 1;
  const item = items[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (many && e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
      if (many && e.key === "ArrowRight") onIndex((index + 1) % items.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, many, onIndex, onClose]);

  if (!item || typeof document === "undefined") return null;

  const step = (dir) => onIndex((index + dir + items.length) % items.length);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-black/90">
      <div className="flex items-center justify-end gap-1 p-3">
        <a
          href={item.src}
          download={item.name || "image"}
          className="grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-white/10 hover:text-foreground"
          title="download"
        >
          <DownloadIcon />
        </a>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-white/10 hover:text-foreground"
          title="close"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-10"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- stored / data image */}
        <img
          src={item.src}
          alt={item.name || "image"}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {many && (
        <div className="flex items-center justify-center gap-4 p-4 text-sm text-muted">
          <button
            onClick={() => step(-1)}
            className="grid h-9 w-9 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-foreground"
            title="previous"
          >
            <span className="rotate-90">
              <ArrowDownIcon />
            </span>
          </button>
          <span className="tabular-nums">
            {index + 1} / {items.length}
          </span>
          <button
            onClick={() => step(1)}
            className="grid h-9 w-9 place-items-center rounded-md transition-colors hover:bg-white/10 hover:text-foreground"
            title="next"
          >
            <span className="-rotate-90">
              <ArrowDownIcon />
            </span>
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
