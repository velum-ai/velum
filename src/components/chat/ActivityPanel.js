"use client";

import { useState } from "react";
import {
  SearchIcon,
  TerminalIcon,
  LinkIcon,
  ImageIcon,
  CheckIcon,
} from "@/components/chat/icons";

const LABELS = {
  web_search: "searched the web",
  run_python: "ran python",
  fetch_url: "read a page",
  generate_image: "generated an image",
};

const ICONS = {
  web_search: SearchIcon,
  run_python: TerminalIcon,
  fetch_url: LinkIcon,
  generate_image: ImageIcon,
};

function Row({ item }) {
  const [open, setOpen] = useState(false);
  const running = item.status === "running";
  const failed = !running && item.output?.startsWith("error:");
  const input = item.code || item.query || item.url || item.prompt;
  const detail = [input, item.output].filter(Boolean).join("\n\n");
  const Icon = ICONS[item.name] || SearchIcon;

  return (
    <div className="w-full">
      <button
        onClick={() => detail && setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md px-1 py-1 font-chat text-xs transition-colors ${
          detail ? "text-faint hover:text-muted" : "text-faint"
        }`}
      >
        <span className={running ? "text-muted" : "text-faint"}>
          <Icon />
        </span>
        {LABELS[item.name] || item.name}
        {running ? (
          <span className="thinking">
            <span />
            <span />
            <span />
          </span>
        ) : failed ? (
          <span className="italic">failed</span>
        ) : (
          <CheckIcon />
        )}
      </button>
      {open && detail && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap border-l border-border pl-3 font-mono text-[12px] leading-5 text-muted">
          {detail}
        </pre>
      )}
    </div>
  );
}

// Live "doing X" trail above the reply: web search while it's running (known
// client-side at send time), a tool call once the model asks for one
// (pushed by the server as it happens). Click a row to see the code/output.
export default function ActivityPanel({ activity }) {
  if (!activity?.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {activity.map((item, i) => (
        <Row key={`${item.name}-${i}`} item={item} />
      ))}
    </div>
  );
}
