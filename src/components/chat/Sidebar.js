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
  FolderIcon,
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
  projects = [],
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
  onMoveChatToProject,
  onOpenProject,
  onOpenProjects,
  width,
  onResize,
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
  const [moveChat, setMoveChat] = useState(null);
  const [draggingChatId, setDraggingChatId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const menuButtonRefs = useRef({});

  const dragProps = (chat) => ({
    draggable: true,
    onDragStart: (e) => {
      setDraggingChatId(chat.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", chat.id);
    },
    onDragEnd: () => {
      setDraggingChatId(null);
      setDropTarget(null);
    },
  });

  const dropProps = (targetId, onDrop = onMoveChatToProject) => ({
    onDragOver: (e) => {
      if (!draggingChatId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== targetId) setDropTarget(targetId);
    },
    onDragLeave: () => setDropTarget((prev) => (prev === targetId ? null : prev)),
    onDrop: (e) => {
      e.preventDefault();
      const chatId = e.dataTransfer.getData("text/plain") || draggingChatId;
      setDraggingChatId(null);
      setDropTarget(null);
      if (chatId) onDrop(chatId, targetId);
    },
  });

  const pinDropProps = dropProps("pin", (chatId) => onTogglePin(chatId, true));

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

  const renderChatRow = (chat) => {
    const active = chat.id === activeChatId;
    return (
      <div
        key={chat.id}
        {...dragProps(chat)}
        className={`group flex items-center rounded-md transition-colors ${
          active ? "bg-surface" : "hover:bg-surface"
        } ${draggingChatId === chat.id ? "opacity-40" : ""}`}
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
              className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint opacity-100 transition-colors hover:bg-surface-2 hover:text-foreground md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
            >
              <MoreIcon />
            </button>
          </>
        )}
      </div>
    );
  };

  const sectionLabel = "px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint";

  const pinned = chats.filter((c) => c.pinned);
  const ungrouped = chats.filter((c) => !c.projectId && !c.pinned);

  const renderChatList = () => (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
      {chats.length === 0 && !projects.length && (
        <p className="px-2 py-3 text-xs text-faint">no chats yet</p>
      )}

      <div>
        <p
          {...pinDropProps}
          className={`${sectionLabel} rounded-md transition-colors ${
            dropTarget === "pin" ? "bg-surface-2 ring-1 ring-border-strong" : ""
          }`}
        >
          pinned
        </p>
        <div className="space-y-0.5">
          {pinned.length > 0 ? (
            pinned.map(renderChatRow)
          ) : (
            <div className="mx-2 grid h-8 place-items-center rounded-md border border-dashed border-border text-faint">
              <PinIcon />
            </div>
          )}
        </div>
      </div>

      {ungrouped.length > 0 && (
        <div>
          <p
            {...dropProps("recents", (chatId) => {
              onMoveChatToProject(chatId, null);
              onTogglePin(chatId, false);
            })}
            className={`${sectionLabel} rounded-md transition-colors ${
              dropTarget === "recents" ? "bg-surface-2 ring-1 ring-border-strong" : ""
            }`}
          >
            recents
          </p>
          <div className="space-y-0.5">{ungrouped.map(renderChatRow)}</div>
        </div>
      )}
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
        {onOpenProjects && (
          <button
            onClick={() => {
              onOpenProjects();
              onCloseMobile?.();
            }}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <FolderIcon />
            projects
          </button>
        )}
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

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev) => {
      const next = Math.min(420, Math.max(200, startWidth + (ev.clientX - startX)));
      onResize?.(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      <aside
        style={{ width: desktopHidden ? undefined : width }}
        className={`relative hidden shrink-0 flex-col border-r border-border ${
          desktopHidden ? "" : "md:flex"
        }`}
      >
        {renderPanel()}
        {!desktopHidden && (
          <div
            onMouseDown={startResize}
            title="drag to resize"
            className="absolute inset-y-0 -right-0.5 z-10 hidden w-1 cursor-col-resize md:block hover:bg-border-strong"
          />
        )}
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
              {projects.length > 0 && (
                <button
                  onClick={() => {
                    setMoveChat({ id: menuChat.id, right: menuChat.right, top: menuChat.top, bottom: menuChat.bottom });
                    closeMenu();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  move to project
                </button>
              )}
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

      {moveChat &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMoveChat(null)} />
            <div
              style={{
                right: moveChat.right,
                ...(moveChat.top !== undefined ? { top: moveChat.top } : { bottom: moveChat.bottom }),
              }}
              className="fixed z-[70] max-h-60 w-40 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl"
            >
              <button
                onClick={() => {
                  onMoveChatToProject(moveChat.id, null);
                  setMoveChat(null);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                no project
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onMoveChatToProject(moveChat.id, p.id);
                    setMoveChat(null);
                  }}
                  className="block w-full truncate px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}

    </>
  );
}
