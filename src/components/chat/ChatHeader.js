"use client";

import { DEFAULT_MODEL } from "@/lib/limits";
import { useEffect, useRef, useState } from "react";
import {
  MenuIcon,
  IncognitoIcon,
  PlusIcon,
  SidebarIcon,
  ShareIcon,
  CopyIcon,
  CheckIcon,
} from "@/components/chat/icons";
import ModelPicker from "@/components/chat/ModelPicker";
import ThemeToggle from "@/components/ThemeToggle";

export default function ChatHeader({
  models,
  model,
  onModelChange,
  ephemeral,
  onToggleEphemeral,
  onNewChat,
  onOpenSidebar,
  sidebarHidden,
  onShowSidebar,
  chatId,
  shared,
  onToggleShared,
}) {
  const options = models.length
    ? models
    : [{ id: DEFAULT_MODEL, label: DEFAULT_MODEL }];
  const [copied, setCopied] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const shareRef = useRef(null);

  useEffect(() => {
    if (!linkOpen) return;
    const onClick = (e) => {
      if (!shareRef.current?.contains(e.target)) setLinkOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [linkOpen]);

  const shareUrl =
    chatId && typeof window !== "undefined" ? `${window.location.origin}/share/${chatId}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked - the link is still shown on screen to copy by hand
    }
  };

  // First click while off: turn sharing on and show the link. While already
  // on: just reopen the link panel, turning it off is a deliberate action
  // inside the panel, not a second click of the same icon.
  const handleShareClick = () => {
    if (!shared) onToggleShared();
    setLinkOpen(true);
    if (!shared) copyLink();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <button
        onClick={onOpenSidebar}
        title="chats"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
      >
        <MenuIcon />
      </button>

      {sidebarHidden && (
        <button
          onClick={onShowSidebar}
          title="show sidebar"
          className="hidden h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:grid"
        >
          <SidebarIcon />
        </button>
      )}

      <button
        onClick={onNewChat}
        title="new chat"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
      >
        <PlusIcon />
      </button>

      <ModelPicker models={options} value={model} onChange={onModelChange} />

      <div className="flex-1" />

      <button
        onClick={onToggleEphemeral}
        title={ephemeral ? "temporary chat is on" : "start a temporary chat"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors ${
          ephemeral
            ? "border-border-strong bg-surface-2 text-foreground"
            : "border-transparent text-faint hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <IncognitoIcon />
      </button>

      {chatId && (
        <div ref={shareRef} className="relative">
          <button
            onClick={handleShareClick}
            title={shared ? "view or copy the share link" : "share a read-only link to this chat"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors ${
              shared
                ? "border-border-strong bg-surface-2 text-foreground"
                : "border-transparent text-faint hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <ShareIcon />
          </button>
          {linkOpen && shared && (
            <div className="absolute right-0 top-9 z-20 w-72 rounded-lg border border-border bg-surface p-3 shadow-xl">
              <p className="mb-2 text-xs text-muted">
                anyone with this link can view this chat, read-only.
              </p>
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {shareUrl}
                </span>
                <button
                  onClick={copyLink}
                  title="copy link"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-surface hover:text-foreground"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
              <button
                onClick={() => {
                  onToggleShared();
                  setLinkOpen(false);
                }}
                className="mt-2 text-xs text-faint underline transition-colors hover:text-foreground"
              >
                turn off sharing
              </button>
            </div>
          )}
        </div>
      )}

      <ThemeToggle />
    </header>
  );
}
