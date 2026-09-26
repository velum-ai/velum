"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/clientApi";
import { SearchIcon } from "@/components/chat/icons";

// Cmd/Ctrl+K. Filters actions and chat titles locally; queries /api/search for
// matches inside message bodies (debounced). Arrow keys + enter, or click.
export default function CommandPalette({
  open,
  onClose,
  account,
  chats,
  onSelectChat,
  onNewChat,
  onToggleEphemeral,
  onOpenAccount,
  scopeProjectId = null,
  scopeLabel = null,
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset on each open */
    setQ("");
    setHits([]);
    setActive(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2 || !account) return;
    const t = setTimeout(async () => {
      const { ok, data } = await api("/api/search", { body: { account, q: term } });
      if (ok && Array.isArray(data.results)) setHits(data.results);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, account]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const scopedChats = scopeProjectId ? chats.filter((c) => c.projectId === scopeProjectId) : chats;
    const scopedChatIds = scopeProjectId ? new Set(scopedChats.map((c) => c.id)) : null;

    const actions = scopeProjectId
      ? [{ key: "new", label: `new chat in ${scopeLabel}`, hint: "command", run: onNewChat }]
      : [
          { key: "new", label: "new chat", hint: "command", run: onNewChat },
          { key: "temp", label: "toggle temporary chat", hint: "command", run: onToggleEphemeral },
          { key: "acct", label: "open account", hint: "command", run: onOpenAccount },
        ];
    const filteredActions = actions.filter((a) => !term || a.label.includes(term));

    const titles = (term ? scopedChats.filter((c) => c.title.toLowerCase().includes(term)) : scopedChats)
      .slice(0, term ? 8 : 6)
      .map((c) => ({ key: `c:${c.id}`, label: c.title, hint: "chat", run: () => onSelectChat(c) }));

    const bodies = (term.length >= 2 ? hits : [])
      .filter((h) => !scopedChatIds || scopedChatIds.has(h.chatId))
      .map((h) => ({
        key: `m:${h.messageId}`,
        label: h.title,
        hint: h.snippet,
        run: () => onSelectChat({ id: h.chatId, title: h.title }),
      }));

    return [...filteredActions, ...titles, ...bodies];
  }, [q, chats, hits, onNewChat, onToggleEphemeral, onOpenAccount, onSelectChat, scopeProjectId, scopeLabel]);

  if (!open) return null;

  const idx = items.length ? Math.min(active, items.length - 1) : 0;

  const activate = (item) => {
    onClose();
    item?.run?.();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(idx + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(items[idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <span className="text-faint">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              scopeProjectId
                ? `search in ${scopeLabel}…`
                : "search chats and messages, or run a command"
            }
            className="w-full bg-transparent py-3 font-chat text-sm outline-none placeholder:text-faint"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center font-chat text-sm text-faint">
              no matches
            </p>
          ) : (
            items.map((item, i) => (
              <button
                key={item.key}
                onMouseEnter={() => setActive(i)}
                onClick={() => activate(item)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left font-chat text-sm ${
                  i === idx ? "bg-surface-2 text-foreground" : "text-muted"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="max-w-[55%] shrink-0 truncate text-[11px] text-faint">
                  {item.hint}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
