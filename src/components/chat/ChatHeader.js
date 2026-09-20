"use client";

import Link from "next/link";
import { DEFAULT_MODEL } from "@/lib/limits";
import {
  MenuIcon,
  IncognitoIcon,
  PlusIcon,
  SidebarIcon,
} from "@/components/chat/icons";
import ModelPicker from "@/components/chat/ModelPicker";
import ThemeToggle from "@/components/ThemeToggle";

export default function ChatHeader({
  models,
  model,
  onModelChange,
  credits,
  ephemeral,
  onToggleEphemeral,
  onNewChat,
  onOpenSidebar,
  sidebarHidden,
  onShowSidebar,
}) {
  const options = models.length
    ? models
    : [{ id: DEFAULT_MODEL, label: DEFAULT_MODEL }];

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

      <div className="flex-1" />

      <ThemeToggle />

      {/* balance lives in the sidebar footer on desktop; show it here only when
          the sidebar is a drawer */}
      <Link
        href="/account"
        title="balance and credit"
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs tabular-nums text-foreground transition-colors hover:border-border-strong md:hidden"
      >
        {credits === null ? "…" : `${credits.toLocaleString()} cr`}
        <span className="text-faint">+</span>
      </Link>
    </header>
  );
}
