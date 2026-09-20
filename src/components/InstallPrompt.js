"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "velum_install_dismissed";

// Shows a small chip when the browser offers to install velum as an app. The
// manifest and icons already exist; this just surfaces the native prompt.
export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage blocked */
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setEvt(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt) return null;

  const dismiss = () => {
    setEvt(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-muted">install velum</span>
      <button
        onClick={async () => {
          evt.prompt();
          await evt.userChoice.catch(() => {});
          dismiss();
        }}
        className="rounded border border-border-strong px-2 py-0.5 text-foreground transition-colors hover:bg-surface-2"
      >
        add
      </button>
      <button
        onClick={dismiss}
        title="dismiss"
        className="text-faint transition-colors hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
