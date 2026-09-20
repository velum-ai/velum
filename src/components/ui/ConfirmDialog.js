"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

// Confirm a destructive action. Optional `phrase`: the confirm button stays
// disabled until the user types it exactly (used for "delete account").
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "confirm",
  phrase,
  busy,
  onConfirm,
  onClose,
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the field when the dialog closes
      setTyped("");
    }
  }, [open]);

  const ready = !phrase || typed.trim() === phrase;

  return (
    <Modal open={open} onClose={onClose} labelledBy="confirm-title">
      <div className="flex flex-col gap-4">
        <h2 id="confirm-title" className="font-chat text-base font-medium">
          {title}
        </h2>
        {body && (
          <p className="font-chat text-sm leading-6 text-muted">{body}</p>
        )}

        {phrase && (
          <label className="flex flex-col gap-1.5 font-chat text-xs text-faint">
            type <span className="text-foreground">{phrase}</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="rounded-md border border-border bg-background px-3 py-2 font-chat text-sm text-foreground outline-none focus:border-border-strong"
            />
          </label>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 font-chat text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready || busy}
            className="rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 font-chat text-sm text-foreground transition-colors hover:border-foreground disabled:opacity-40"
          >
            {busy ? "working..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
