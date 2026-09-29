"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FolderIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/chat/icons";
import Modal from "@/components/ui/Modal";

const relativeTime = (iso) => {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
};

function ProjectMenu({ project, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="project options"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <MoreIcon />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              style={{ right: pos.right, top: pos.top }}
              className="fixed z-[70] w-32 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl"
            >
              <button
                onClick={() => {
                  setOpen(false);
                  onRename(project);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                rename
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete(project.id);
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

export default function ProjectsView({
  projects,
  chats,
  activeProjectId,
  onOpenProject,
  onSelectChat,
  onCreateProject,
  onRenameProject,
  onRemoveProject,
  onNewChatInProject,
  onSearchProject,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(null); // project id
  const [renameValue, setRenameValue] = useState("");

  const closeNewProject = () => {
    setCreating(false);
    setNewName("");
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    closeNewProject();
    onCreateProject(name);
  };

  const submitRename = (id) => {
    const name = renameValue.trim();
    setRenaming(null);
    if (name) onRenameProject(id, name);
  };

  const project = projects.find((p) => p.id === activeProjectId);

  if (activeProjectId && project) {
    const projectChats = chats.filter((c) => c.projectId === project.id);
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-lg font-medium">
              {project.name}
            </h1>
            <button
              onClick={() => onSearchProject(project)}
              title="search this project"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <SearchIcon />
            </button>
            <button
              onClick={() => onNewChatInProject(project.id)}
              title="new chat"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <PlusIcon />
            </button>
          </div>

          {projectChats.length === 0 ? (
            <p className="px-1 py-3 text-sm text-faint">
              no chats in this project yet.
            </p>
          ) : (
            <div className="flex flex-col border-t border-border">
              {projectChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className="flex items-center justify-between gap-3 border-b border-border px-1 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {chat.title}
                    </span>
                    {chat.preview && (
                      <span className="block truncate text-xs text-faint">
                        {chat.preview}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-faint">
                    {(chat.spent || 0).toLocaleString()} cr
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-lg font-medium">projects</h1>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2.5 rounded-md border border-dashed border-border px-3 py-3 text-left text-faint transition-colors hover:text-foreground"
          >
            <PlusIcon />
            <span className="text-sm">new project</span>
          </button>

          {projects.length === 0 ? (
            <p className="px-3 py-3 text-sm text-faint">
              no projects yet. group related chats together to keep them out
              of your recents.
            </p>
          ) : (
            <div className="flex flex-col border-t border-border">
              {projects.map((p) => {
                const projectChats = chats.filter((c) => c.projectId === p.id);
                const count = projectChats.length;
                const lastActive = projectChats.reduce(
                  (max, c) => (c.updatedAt && c.updatedAt > max ? c.updatedAt : max),
                  "",
                );
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 border-b border-border transition-colors hover:bg-surface"
                  >
                    {renaming === p.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(p.id);
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        className="w-full bg-surface-2 px-3 py-3 text-sm outline-none"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => onOpenProject(p)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3 text-left"
                        >
                          <span className="shrink-0 text-faint">
                            <FolderIcon />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {p.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-faint">
                            {count} {count === 1 ? "chat" : "chats"}
                            {lastActive && ` · ${relativeTime(lastActive)}`}
                          </span>
                        </button>
                        <ProjectMenu
                          project={p}
                          onRename={(proj) => {
                            setRenaming(proj.id);
                            setRenameValue(proj.name);
                          }}
                          onDelete={onRemoveProject}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={creating} onClose={closeNewProject} labelledBy="new-project-title">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitNew();
          }}
          className="flex flex-col gap-4"
        >
          <h2 id="new-project-title" className="font-chat text-base font-medium">
            new project
          </h2>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="project name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-chat text-sm text-foreground outline-none focus:border-border-strong"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeNewProject}
              className="rounded-md px-3 py-1.5 font-chat text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-md border border-border-strong bg-surface-2 px-3 py-1.5 font-chat text-sm text-foreground transition-colors hover:border-foreground disabled:opacity-40"
            >
              create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
