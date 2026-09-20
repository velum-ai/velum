"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/chat/icons";
import { TIER_LABELS } from "@/lib/pricing";

// Themed dropdown for the model selector. Replaces a native <select> so it
// matches the rest of the UI.
export default function ModelPicker({ models, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = models.find((m) => m.id === value);
  const label = current?.label || value || "model";

  // preserve incoming order (already tier-sorted by /api/models); only add a
  // heading when more than one tier is present
  const groups = (() => {
    const order = [];
    const bucket = new Map();
    for (const m of models) {
      const t = m.tier || "";
      if (!bucket.has(t)) {
        bucket.set(t, []);
        order.push(t);
      }
      bucket.get(t).push(m);
    }
    const multi = order.filter(Boolean).length > 1;
    return order.map((t) => [multi ? t : "", bucket.get(t)]);
  })();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 font-chat text-sm text-foreground transition-colors hover:border-border-strong"
      >
        {label}
        <span className="text-faint">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] min-w-[200px] overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl">
          {groups.map(([tier, rows]) => (
            <div key={tier}>
              {tier && (
                <p className="px-3 pb-0.5 pt-2 text-[10px] uppercase tracking-[0.14em] text-faint">
                  {TIER_LABELS[tier] || tier}
                </p>
              )}
              {rows.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-chat text-sm transition-colors hover:bg-surface-2 ${
                    m.id === value ? "text-foreground" : "text-muted"
                  }`}
                >
                  {m.label}
                  {m.id === value && (
                    <span className="text-faint">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
