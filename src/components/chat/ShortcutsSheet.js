"use client";

import Modal from "@/components/ui/Modal";

const mod = typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
  ? "⌘"
  : "ctrl";

const ROWS = [
  ["command palette", [mod, "k"]],
  ["new chat", [mod, "shift", "o"]],
  ["toggle sidebar", [mod, "b"]],
  ["temporary chat", [mod, "shift", "."]],
  ["focus composer", ["/"]],
  ["generate an image", ["/image", "…"]],
  ["copy last reply", [mod, "shift", "c"]],
  ["stop / close", ["esc"]],
  ["this help", ["?"]],
];

export default function ShortcutsSheet({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="shortcuts-title">
      <div className="flex flex-col gap-4">
        <h2 id="shortcuts-title" className="font-chat text-base font-medium">
          keyboard shortcuts
        </h2>
        <div className="flex flex-col">
          {ROWS.map(([label, keys]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-border py-2 font-chat text-sm text-muted last:border-b-0"
            >
              {label}
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
