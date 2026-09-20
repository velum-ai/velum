"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  PlusIcon,
  CloseIcon,
  MoreIcon,
  SearchIcon,
  SidebarIcon,
  PinIcon,
  SignOutIcon,
  UserIcon,
} from "@/components/chat/icons";

const MENU_HEIGHT = 108; // three rows - used to decide whether to flip upward

// first four and last four visible, the middle hidden
const maskedNumber = (n) => {
  const d = String(n ?? "").replace(/\D/g, "");
  if (d.length < 8) return "account";
  return `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}`;
};

const SKELETON_WIDTHS = ["78%", "62%", "88%", "50%", "70%", "45%", "82%"];

function ChatListSkeleton() {
  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-hidden px-2 pt-1">
      {SKELETON_WIDTHS.map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2">
          <div className="sk h-3" style={{ width: w }} />
          <div className="sk h-2 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({
  chats,
  loading,
  activeChatId,
  editingChatId,
  editTitle,
  onEditTitleChange,
  onStartNewChat,
  onSelectChat,
  onStartRename,
  onCancelRename,
  onRenameChat,
  onRemoveChat,
  onTogglePin,
  account,
  credits,
  onSignOut,
  onSearch,
  desktopHidden,
  onToggleDesktop,
  mobileOpen,
  onCloseMobile,
}) {
  const [menuChat, setMenuChat] = useState(null);
  const menuButtonRefs = useRef({});

  const openMenu = (chat) => {
    const btn = menuButtonRefs.current[chat.id];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const roomBelow = window.innerHeight - rect.bottom;
    setMenuChat(
      roomBelow >= MENU_HEIGHT
        ? { id: chat.id, right, top: rect.bottom + 4 }
        : { id: chat.id, right, bottom: window.innerHeight - rect.top + 4 },
    );
  };

  const closeMenu = () => setMenuChat(null);

  useEffect(() => {
    if (!menuChat) return;
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, [menuChat]);

  const pickChat = (chat) => {
    onSelectChat(chat);
    onCloseMobile?.();
  };

  const newChat = () => {
    onStartNewChat();
    onCloseMobile?.();
  };

  const menuTarget = chats.find((c) => c.id === menuChat?.id);

  const renderChatList = () => (
    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
      {chats.length === 0 && (
        <p className="px-2 py-3 text-xs text-faint">no chats yet</p>
      )}
      {chats.map((chat) => {
        const active = chat.id === activeChatId;
        return (
          <div
            key={chat.id}
            className={`group flex items-center rounded-md transition-colors ${
              active ? "bg-surface" : "hover:bg-surface"
            }`}
          >
            {editingChatId === chat.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => onEditTitleChange(e.target.value)}
                onBlur={() => onRenameChat(chat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRenameChat(chat.id);
                  if (e.key === "Escape") onCancelRename();
                }}
                className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm outline-none"
              />
            ) : (
              <>
                <button
                  onClick={() => pickChat(chat)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left"
                >
                  {chat.pinned && (
                    <span className="shrink-0 text-faint">
                      <PinIcon />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        active ? "text-foreground" : "text-muted"
                      }`}
                    >
                      {chat.title}
                    </span>
                    <span className="block text-[11px] tabular-nums text-faint">
                      {(chat.spent || 0).toLocaleString()} cr
                    </span>
                  </span>
                </button>
                <button
                  ref={(el) => (menuButtonRefs.current[chat.id] = el)}
                  onClick={() =>
                    menuChat?.id === chat.id ? closeMenu() : openMenu(chat)
                  }
                  title="options"
                  className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint opacity-0 transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <MoreIcon />
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const stripBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground";

  const renderPanel = (closeButton = null) => (
    <>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2">
        <Link
          href="/"
          onClick={onCloseMobile}
          className="mr-auto px-2 font-mono text-base font-medium tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          velum
        </Link>
        <button onClick={onSearch} title="search chats and messages" className={stripBtn}>
          <SearchIcon />
        </button>
        {onToggleDesktop && (
          <button
            onClick={onToggleDesktop}
            title="hide sidebar"
            className={`${stripBtn} hidden md:grid`}
          >
            <SidebarIcon />
          </button>
        )}
        {closeButton}
      </div>
      <div className="flex flex-col gap-2 p-2">
        <button
          onClick={newChat}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:border-border-strong"
        >
          <PlusIcon />
          new chat
        </button>
      </div>
      {loading && chats.length === 0 ? <ChatListSkeleton /> : renderChatList()}

      <div className="shrink-0 border-t border-border p-2">
        {account ? (
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              onClick={onCloseMobile}
              title="account and credit"
              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center text-muted group-hover:text-foreground">
                <UserIcon />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-mono text-xs tracking-tight text-foreground">
                  {maskedNumber(account)}
                </span>
                {credits == null ? (
                  <span className="sk mt-1 block h-2.5 w-16" />
                ) : (
                  <span className="block text-[11px] tabular-nums text-faint">
                    {credits.toLocaleString()} credits
                  </span>
                )}
              </span>
            </Link>
            <button
              onClick={onSignOut}
              title="sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <SignOutIcon />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="sk h-8 w-8 shrink-0 rounded-md" />
            <span className="flex-1 space-y-1.5">
              <span className="sk block h-3 w-32" />
              <span className="sk block h-2.5 w-16" />
            </span>
            <span className="sk h-8 w-8 shrink-0 rounded-md" />
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`hidden w-64 shrink-0 flex-col border-r border-border ${
          desktopHidden ? "" : "md:flex"
        }`}
      >
        {renderPanel()}
      </aside>

      {mobileOpen &&
        createPortal(
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onCloseMobile}
            />
            <div className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] flex-col border-r border-border bg-background">
              {renderPanel(
                <button
                  onClick={onCloseMobile}
                  title="close"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <CloseIcon />
                </button>,
              )}
            </div>
          </div>,
          document.body,
        )}

      {menuChat &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={closeMenu} />
            <div
              style={{
                right: menuChat.right,
                ...(menuChat.top !== undefined
                  ? { top: menuChat.top }
                  : { bottom: menuChat.bottom }),
              }}
              className="fixed z-[70] w-36 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl"
            >
              <button
                onClick={() => {
                  closeMenu();
                  if (menuTarget) onTogglePin(menuTarget.id, !menuTarget.pinned);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {menuTarget?.pinned ? "unpin" : "pin"}
              </button>
              <button
                onClick={() => {
                  closeMenu();
                  if (menuTarget) onStartRename(menuTarget);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                rename
              </button>
              <button
                onClick={() => {
                  onRemoveChat(menuChat.id);
                  closeMenu();
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                delete
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
