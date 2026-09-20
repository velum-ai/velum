"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/clientApi";
import { parseSSE } from "@/lib/sse";
import { reserveEstimate } from "@/lib/estimate";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import Composer from "@/components/chat/Composer";
import CommandPalette from "@/components/chat/CommandPalette";
import ShortcutsSheet from "@/components/chat/ShortcutsSheet";
import {
  DEFAULT_MODEL,
  STORAGE_KEY,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  IMAGE_TYPES,
} from "@/lib/limits";

function pickDefaultModel(models) {
  const cheap = models.find((m) => /nano|mini|flash|haiku|nemo/.test(m.id));
  return (cheap || models[0])?.id;
}

const sortChats = (list) => [
  ...list.filter((c) => c.pinned),
  ...list.filter((c) => !c.pinned),
];

const HISTORY_CHAR_CAP = 24000;

const DRAFT_PREFIX = "velum_draft:";
const LENGTH_KEY = "velum_length";
const LAST_CHAT_KEY = "velum_last_chat";
const SIDEBAR_KEY = "velum_sidebar";
const readLS = (k, fallback = "") => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeLS = (k, v) => {
  try {
    v ? localStorage.setItem(k, v) : localStorage.removeItem(k);
  } catch {
    /* storage blocked */
  }
};
const clearDrafts = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DRAFT_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
};

// starts with an imperative verb and names a visual artefact
const IMAGE_INTENT =
  /^\s*(?:generate|create|draw|paint|render|design|make me|give me)\b[^.?!]*\b(?:image|picture|photo(?:graph)?|illustration|logo|icon|artwork|drawing|painting|poster|wallpaper|sketch|render)\b/i;

// signals the user wants text output, not a generated image
const NOT_IMAGE = /\b(ascii|in text|as text|markdown|code|table|diagram|list)\b/i;

function detectImagePrompt(text) {
  const m = /^\s*\/(?:image|img)\s+([\s\S]+)/i.exec(text);
  if (m) return m[1].trim();
  if (IMAGE_INTENT.test(text) && !NOT_IMAGE.test(text)) return text.trim();
  return null;
}

const idFromPath = (p) => (p && p.startsWith("/chat/") ? p.slice(6) : null);

// reflect the open thread in the URL without a Next navigation (the whole
// /chat/* tree is one route, so the page never remounts)
const syncUrl = (id, replace = false) => {
  if (typeof window === "undefined") return;
  const path = id ? `/chat/${id}` : "/chat";
  if (window.location.pathname === path) return;
  window.history[replace ? "replaceState" : "pushState"]({}, "", path);
};

export default function ChatPage() {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [credits, setCredits] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [maxOutput, setMaxOutput] = useState(4000);
  const [imageInfo, setImageInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("chat");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [length, setLength] = useState("balanced");
  const [booting, setBooting] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const focusComposer = () =>
    requestAnimationFrame(() => inputRef.current?.focus());

  const outOfCredits = credits === 0;

  const addImages = (files) => {
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) =>
          prev.length >= MAX_IMAGES ? prev : [...prev, reader.result],
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) addImages([file]);
      }
    }
  };

  const loadAccount = (stored) =>
    api("/api/account/lookup", { body: { account: stored } }).then(
      ({ data }) => {
        if (typeof data.credits === "number") setCredits(data.credits);
        if (Array.isArray(data.chats)) setChats(sortChats(data.chats));
        return data;
      },
    );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = readLS(STORAGE_KEY, "");
    if (!stored) {
      router.push("/create-account");
      return;
    }
    setAccount(stored);

    // the URL wins over the remembered thread; either may be absent
    const wanted = idFromPath(window.location.pathname) || readLS(LAST_CHAT_KEY, "");
    if (!wanted) setBooting(false); // fresh chat: show the empty state now

    // one round trip: balance + chat list + the wanted thread's messages
    api("/api/account/lookup", {
      body: { account: stored, chatId: wanted || undefined },
    })
      .then(({ ok, status, data }) => {
        if (!ok) {
          if (status === 400) {
            localStorage.removeItem(STORAGE_KEY);
            router.push("/login");
          }
          return;
        }
        if (typeof data.credits === "number") setCredits(data.credits);
        if (Array.isArray(data.chats)) setChats(sortChats(data.chats));
        if (data.chat) {
          setActiveChatId(data.chat.id);
          setMessages(data.chat.messages || []);
          writeLS(LAST_CHAT_KEY, data.chat.id);
          syncUrl(data.chat.id, true);
        } else {
          if (wanted) writeLS(LAST_CHAT_KEY, ""); // stale / deleted
          syncUrl(null, true);
        }
      })
      .finally(() => setBooting(false));
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const stored = readLS(STORAGE_KEY, "");
    if (!stored) return;
    api("/api/models", { body: { account: stored } }).then(({ data }) => {
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setModel(pickDefaultModel(data.models));
      }
      if (data.maxOutput) setMaxOutput(data.maxOutput);
      if (data.image) setImageInfo(data.image);
    });
    const savedLen = readLS(LENGTH_KEY);
    if (["concise", "balanced", "detailed"].includes(savedLen)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore
      setLength(savedLen);
    }
    if (readLS(SIDEBAR_KEY) === "hidden") setSidebarHidden(true);
    setInput(readLS(DRAFT_PREFIX + "new"));
    focusComposer();
  }, []);

  const draftKey = ephemeral ? null : DRAFT_PREFIX + (activeChatId ?? "new");

  // persist the composer draft per thread so it survives navigation
  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => writeLS(draftKey, input.trim() ? input : ""), 300);
    return () => clearTimeout(t);
  }, [input, draftKey]);

  const setSidebarHiddenPersist = (hidden) => {
    setSidebarHidden(hidden);
    writeLS(SIDEBAR_KEY, hidden ? "hidden" : "");
  };

  const changeLength = (l) => {
    setLength(l);
    writeLS(LENGTH_KEY, l);
  };

  const startNewChat = ({ push = true } = {}) => {
    setActiveChatId(null);
    setMessages([]);
    setLoadingChat(false);
    setMode("chat");
    setInput(readLS(DRAFT_PREFIX + "new"));
    writeLS(LAST_CHAT_KEY, "");
    if (push) syncUrl(null);
    focusComposer();
  };

  const toggleEphemeral = () => {
    const next = !ephemeral;
    setEphemeral(next);
    setActiveChatId(null);
    setMessages([]);
    setLoadingChat(false);
    setInput(next ? "" : readLS(DRAFT_PREFIX + "new"));
    writeLS(LAST_CHAT_KEY, "");
    syncUrl(null);
    focusComposer();
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    clearDrafts();
    writeLS(LAST_CHAT_KEY, "");
    router.push("/login");
  };

  const selectChat = async (chat, { push = true, acct = account } = {}) => {
    setEphemeral(false);
    setMode("chat");
    setActiveChatId(chat.id);
    // show the cached thread if we have it, otherwise a skeleton while it loads
    const cached = Array.isArray(chat.messages) && chat.messages.length > 0;
    setMessages(cached ? chat.messages : []);
    setLoadingChat(!cached);
    setInput(readLS(DRAFT_PREFIX + chat.id));
    writeLS(LAST_CHAT_KEY, chat.id);
    if (push) syncUrl(chat.id);
    try {
      const { ok, data } = await api("/api/chats", {
        body: { account: acct, chatId: chat.id },
      });
      if (ok && Array.isArray(data.messages)) setMessages(data.messages);
    } finally {
      setLoadingChat(false);
      focusComposer();
    }
  };

  // back / forward between threads
  useEffect(() => {
    const onPop = () => {
      const id = idFromPath(window.location.pathname);
      if (id === activeChatId) return;
      if (!id) return startNewChat({ push: false });
      const known = chats.find((c) => c.id === id);
      if (known) return selectChat(known, { push: false });
      api("/api/chats", { body: { account, chatId: id } }).then(({ ok, data }) => {
        if (ok && data.id) selectChat(data, { push: false });
        else startNewChat({ push: false });
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [chats, activeChatId, account]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopGeneration = () => abortRef.current?.abort();

  // one path for a new message, an edit (resend from a user turn) and a
  // regenerate (rerun the last assistant turn). replaceFromIndex trims local
  // state and, on the server, the stored thread; appendUser is false only when
  // regenerating.
  const runChat = async ({ text, imgs = [], replaceFromIndex = null, appendUser = true }) => {
    if (!account || sending) return;

    let base =
      replaceFromIndex != null ? messages.slice(0, replaceFromIndex) : messages;
    if (appendUser) {
      base = [...base, { role: "user", content: text, ...(imgs.length && { images: imgs }) }];
    }
    const startedAt = Date.now();
    const retry = { text, imgs, appendUser };
    setMessages([
      ...base,
      { role: "assistant", content: "", reasoning: "", startedAt },
    ]);
    setInput("");
    if (draftKey) writeLS(draftKey, "");
    setImages([]);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const anchorId =
      replaceFromIndex != null ? messages[replaceFromIndex - 1]?.id ?? 0 : null;

    let acc = "";
    let reason = "";
    let frame = null;
    const flush = () => {
      frame = null;
      setMessages([
        ...base,
        { role: "assistant", content: acc, reasoning: reason, startedAt },
      ]);
    };
    const paint = () => {
      if (frame == null) frame = requestAnimationFrame(flush);
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account,
          chatId: ephemeral ? null : activeChatId,
          message: text,
          model,
          length,
          appendUser,
          ...(imgs.length && { images: imgs }),
          ...(anchorId != null && !ephemeral && { truncateAfterId: anchorId }),
          ...(ephemeral && {
            ephemeral: true,
            history: (appendUser ? base.slice(0, -1) : base).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) setCredits(0);
        setMessages([
          ...base,
          {
            role: "assistant",
            content: data.error || "something went wrong",
            error: true,
            retry: res.status === 402 ? null : retry,
          },
        ]);
        return;
      }

      let final = null;
      let errored = null;
      for await (const json of parseSSE(res.body)) {
        if (json.reasoning) {
          reason += json.reasoning;
          paint();
        }
        if (json.delta) {
          acc += json.delta;
          paint();
        }
        if (json.error) errored = json.error;
        if (json.done) final = json;
      }
      if (frame != null) cancelAnimationFrame(frame);

      const replyContent = acc || (errored ? `_${errored}_` : "");

      if (final) {
        setCredits(final.credits);
        const finalMsg = {
          role: "assistant",
          content: replyContent,
          reasoning: reason || null,
          cost: final.cost,
          model,
          id: final.messageId,
          startedAt,
        };
        if (final.ephemeral) {
          setMessages([...base, finalMsg]);
          return;
        }
        const userMsg = { ...base[base.length - 1], id: final.userMessageId };
        const withUser = appendUser ? [...base.slice(0, -1), userMsg] : base;
        const finalMessages = [...withUser, finalMsg];
        setMessages(finalMessages);
        setActiveChatId(final.chatId);
        writeLS(LAST_CHAT_KEY, final.chatId);
        syncUrl(final.chatId, true);
        setChats((prev) =>
          sortChats([
            {
              ...(prev.find((c) => c.id === final.chatId) || {}),
              id: final.chatId,
              title: final.title,
              messages: finalMessages,
              spent: final.spent ?? 0,
              pinned: prev.find((c) => c.id === final.chatId)?.pinned ?? false,
            },
            ...prev.filter((c) => c.id !== final.chatId),
          ]),
        );
      } else {
        setMessages([
          ...base,
          {
            role: "assistant",
            content: replyContent || "the response was interrupted",
            error: true,
            retry,
          },
        ]);
      }
    } catch (err) {
      if (frame != null) cancelAnimationFrame(frame);
      if (err?.name === "AbortError") {
        setMessages([
          ...base,
          { role: "assistant", content: acc, reasoning: reason || null, startedAt },
        ]);
        if (account) loadAccount(account);
      } else {
        setMessages([
          ...base,
          { role: "assistant", content: "something went wrong", error: true, retry },
        ]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      focusComposer();
    }
  };

  const generateImage = async (prompt, replaceFromIndex = null) => {
    if (!account || sending || outOfCredits || !prompt.trim()) return;
    const prior =
      replaceFromIndex != null ? messages.slice(0, replaceFromIndex) : messages;
    const base = [...prior, { role: "user", content: prompt }];
    const retry = { imagePrompt: prompt };
    setMessages([...base, { role: "assistant", content: "", generating: true }]);
    setInput("");
    if (draftKey) writeLS(draftKey, "");
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { ok, status, data } = await api("/api/chat/image", {
        body: {
          account,
          chatId: ephemeral ? null : activeChatId,
          prompt,
          ...(ephemeral && { ephemeral: true }),
        },
      });
      if (!ok) {
        if (status === 402) setCredits(0);
        setMessages([
          ...base,
          {
            role: "assistant",
            content: data.error || "image generation failed",
            error: true,
            retry: status === 402 ? null : retry,
          },
        ]);
        return;
      }
      setCredits(data.credits);
      const finalMsg = {
        role: "assistant",
        content: "",
        cost: data.cost,
        model: "image",
        id: data.messageId,
        ...(data.ephemeral
          ? { image: data.image }
          : { attachments: [data.attachment] }),
      };
      const finalMessages = [...base, finalMsg];
      setMessages(finalMessages);
      if (!data.ephemeral) {
        setActiveChatId(data.chatId);
        writeLS(LAST_CHAT_KEY, data.chatId);
        syncUrl(data.chatId, true);
        setChats((prev) =>
          sortChats([
            {
              ...(prev.find((c) => c.id === data.chatId) || {}),
              id: data.chatId,
              title: data.title,
              messages: finalMessages,
              spent: data.spent ?? 0,
              pinned: prev.find((c) => c.id === data.chatId)?.pinned ?? false,
            },
            ...prev.filter((c) => c.id !== data.chatId),
          ]),
        );
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setMessages([
          ...base,
          { role: "assistant", content: "something went wrong", error: true, retry },
        ]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      focusComposer();
    }
  };

  const onSend = () => {
    const text = input.trim();
    if (mode === "image") {
      if (text) generateImage(text);
      return;
    }
    if ((!text && images.length === 0) || sending || outOfCredits) return;
    const imgPrompt = images.length === 0 ? detectImagePrompt(text) : null;
    if (imgPrompt) {
      generateImage(imgPrompt);
      return;
    }
    runChat({ text, imgs: images });
  };

  const retryFailed = (index) => {
    const r = messages[index]?.retry;
    if (!r) return;
    if (r.imagePrompt) {
      generateImage(r.imagePrompt, index - 1);
      return;
    }
    const cut = r.appendUser ? index - 1 : index;
    runChat({ text: r.text, imgs: r.imgs || [], replaceFromIndex: cut, appendUser: r.appendUser });
  };

  const regenerate = (assistantIndex) => {
    const user = messages[assistantIndex - 1];
    if (!user || user.role !== "user") return;
    runChat({
      text: user.content,
      replaceFromIndex: assistantIndex,
      appendUser: false,
    });
  };

  const editMessage = (userIndex, newText) => {
    runChat({ text: newText, replaceFromIndex: userIndex, appendUser: true });
  };

  const renameChat = async (chatId) => {
    const title = editTitle.trim();
    setEditingChatId(null);
    if (!title) return;
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    await api("/api/chats", { method: "PATCH", body: { account, chatId, title } });
  };

  const togglePin = async (chatId, pinned) => {
    setChats((prev) =>
      sortChats(prev.map((c) => (c.id === chatId ? { ...c, pinned } : c))),
    );
    await api("/api/chats", { method: "PATCH", body: { account, chatId, pinned } });
  };

  const removeChat = async (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (chatId === activeChatId) startNewChat();
    await api("/api/chats", { method: "DELETE", body: { account, chatId } });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !sending) {
      e.preventDefault();
      onSend();
    }
  };

  const pickSuggestion = (text) => {
    setInput(text);
    focusComposer();
  };

  // global shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (sending) stopGeneration();
        else setShortcutsOpen(false);
        return;
      }
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && e.shiftKey && k === "o") {
        e.preventDefault();
        startNewChat();
      } else if (mod && k === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      } else if (mod && e.shiftKey && k === ".") {
        e.preventDefault();
        toggleEphemeral();
      } else if (mod && e.shiftKey && k === "c") {
        e.preventDefault();
        const last = [...messages].reverse().find((m) => m.role === "assistant");
        if (last?.content) navigator.clipboard?.writeText(last.content).catch(() => {});
      } else if (!mod && k === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (!mod && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const modelRow = models.find((m) => m.id === model);
  const historyChars = Math.min(
    HISTORY_CHAR_CAP,
    messages.reduce((n, m) => n + (m.content?.length || 0), 0),
  );
  const holdEstimate =
    mode === "image"
      ? imageInfo?.credits ?? null
      : input.trim()
        ? reserveEstimate({
            model: modelRow,
            promptChars: input.length + historyChars,
            maxOutput,
          })
        : null;

  return (
    <main className="fixed inset-0 flex overflow-hidden bg-background">
      <Sidebar
        chats={chats}
        loading={booting}
        activeChatId={activeChatId}
        editingChatId={editingChatId}
        editTitle={editTitle}
        onEditTitleChange={setEditTitle}
        onStartNewChat={startNewChat}
        onSelectChat={selectChat}
        onStartRename={(chat) => {
          setEditingChatId(chat.id);
          setEditTitle(chat.title);
        }}
        onCancelRename={() => setEditingChatId(null)}
        onRenameChat={renameChat}
        onRemoveChat={removeChat}
        onTogglePin={togglePin}
        account={account}
        credits={credits}
        onSignOut={signOut}
        onSearch={() => setPaletteOpen(true)}
        desktopHidden={sidebarHidden}
        onToggleDesktop={() => setSidebarHiddenPersist(true)}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatHeader
          models={models}
          model={model}
          onModelChange={setModel}
          credits={credits}
          ephemeral={ephemeral}
          onToggleEphemeral={toggleEphemeral}
          onNewChat={() => startNewChat()}
          onOpenSidebar={() => setSidebarOpen(true)}
          sidebarHidden={sidebarHidden}
          onShowSidebar={() => setSidebarHiddenPersist(false)}
        />

        <MessageList
          messages={messages}
          sending={sending}
          loading={booting || loadingChat}
          ephemeral={ephemeral}
          activeChatId={activeChatId}
          onPickSuggestion={pickSuggestion}
          onRegenerate={regenerate}
          onEditMessage={editMessage}
          onRetryFailed={retryFailed}
        />

        <Composer
          outOfCredits={outOfCredits}
          credits={credits}
          images={images}
          onRemoveImage={(i) =>
            setImages((prev) => prev.filter((_, j) => j !== i))
          }
          input={input}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          sending={sending}
          onStop={stopGeneration}
          onSend={onSend}
          fileInputRef={fileInputRef}
          onFilesSelected={addImages}
          imageAccept={IMAGE_TYPES.join(",")}
          inputRef={inputRef}
          mode={mode}
          onToggleMode={() => setMode((m) => (m === "image" ? "chat" : "image"))}
          imageEnabled={Boolean(imageInfo)}
          holdEstimate={holdEstimate}
          length={length}
          onLength={changeLength}
        />
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        account={account}
        chats={chats}
        onSelectChat={(c) => selectChat(c)}
        onNewChat={() => startNewChat()}
        onToggleEphemeral={toggleEphemeral}
        onOpenAccount={() => router.push("/account")}
      />

      <ShortcutsSheet
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </main>
  );
}
