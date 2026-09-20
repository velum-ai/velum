"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "@/components/chat/icons";

const secsSince = (t) => (t ? Math.max(0, Math.round((Date.now() - t) / 1000)) : 0);

// The "thinking" affordance. While the reply streams it shows an elapsed timer
// and the reasoning summary live (if the provider sends one). When done it
// collapses to "thought for Ns"; click to reopen. With no reasoning text and no
// live stream it renders nothing.
export default function ThinkingPanel({ reasoning = "", startedAt = null, streaming = false }) {
  const [open, setOpen] = useState(false);
  // real state, ticked by the interval - a derived `Date.now()` value would be
  // memoised by the React compiler and never update.
  const [secs, setSecs] = useState(() => secsSince(startedAt));

  useEffect(() => {
    if (!startedAt) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- sync elapsed time */
    setSecs(secsSince(startedAt));
    if (!streaming) return;
    const t = setInterval(() => setSecs(secsSince(startedAt)), 1000);
    return () => clearInterval(t);
  }, [streaming, startedAt]);

  const hasText = reasoning.trim().length > 0;

  if (streaming) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2 px-1 py-1 font-chat text-xs text-faint">
          {!hasText && (
            <span className="thinking">
              <span />
              <span />
              <span />
            </span>
          )}
          <span className="tabular-nums">
            thinking{startedAt ? ` ${secs}s` : ""}
          </span>
        </div>
        {hasText && (
          <div className="mt-0.5 whitespace-pre-wrap border-l border-border pl-3 font-chat text-[13px] leading-6 text-muted">
            {reasoning}
          </div>
        )}
      </div>
    );
  }

  if (!hasText) return null;

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-1 py-1 font-chat text-xs text-faint transition-colors hover:text-muted"
      >
        <span className={`transition-transform ${open ? "" : "-rotate-90"}`}>
          <ChevronDownIcon />
        </span>
        {startedAt ? `thought for ${secs}s` : "reasoning"}
      </button>
      {open && (
        <div className="mt-1 whitespace-pre-wrap border-l border-border pl-3 font-chat text-[13px] leading-6 text-muted">
          {reasoning}
        </div>
      )}
    </div>
  );
}
