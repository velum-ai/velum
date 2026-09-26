"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PaperclipIcon,
  ArrowUpIcon,
  StopIcon,
  ImageIcon,
  MicIcon,
  FileIcon,
} from "@/components/chat/icons";
import { LENGTHS } from "@/lib/pricing";
import { useDictation } from "@/lib/useDictation";

const MAX_HEIGHT = 200;

function LengthControl({ value, onChange }) {
  return (
    <span className="flex overflow-hidden rounded-md border border-border">
      {LENGTHS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-2 py-0.5 font-chat text-[11px] transition-colors ${
            value === l
              ? "bg-surface-2 text-foreground"
              : "text-faint hover:text-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </span>
  );
}

export default function Composer({
  outOfCredits,
  credits,
  images,
  onRemoveImage,
  files,
  onRemoveFile,
  input,
  onInputChange,
  onKeyDown,
  onPaste,
  sending,
  onStop,
  onSend,
  fileInputRef,
  onFilesSelected,
  fileAccept,
  inputRef,
  mode = "chat",
  onToggleMode,
  imageEnabled,
  holdEstimate,
  length,
  onLength,
}) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  const isImage = mode === "image";
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const canDrop = !isImage && !outOfCredits && !sending;

  const onDragEnter = (e) => {
    if (!canDrop || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e) => {
    if (!canDrop || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e) => {
    if (!canDrop) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) onFilesSelected(e.dataTransfer.files);
  };

  const inputValueRef = useRef(input);
  useEffect(() => {
    inputValueRef.current = input;
  }, [input]);
  const dictation = useDictation((text) => {
    const cur = inputValueRef.current;
    onInputChange(cur && !cur.endsWith(" ") ? `${cur} ${text}` : `${cur}${text}`);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [input, ref]);

  const canSend = Boolean(
    !outOfCredits &&
      (input.trim() || (!isImage && (images.length > 0 || files.length > 0))),
  );
  const lowBalance =
    !outOfCredits &&
    typeof credits === "number" &&
    holdEstimate != null &&
    credits < holdEstimate;

  return (
    <div
      className="relative px-3 pb-3 pt-1 sm:px-6 sm:pb-5"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-lg border-2 border-dashed border-border-strong bg-background/90 font-chat text-sm text-muted">
          drop to attach
        </div>
      )}
      <div className="mx-auto w-full max-w-3xl">
        {outOfCredits && (
          <p className="mb-2 rounded-md border border-border bg-surface px-3 py-2 text-center font-chat text-sm text-muted">
            no credits left.{" "}
            <Link href="/account" className="text-foreground underline">
              add credit
            </Link>{" "}
            to keep chatting.
          </p>
        )}

        {lowBalance && (
          <p className="mb-2 rounded-md border border-border bg-surface px-3 py-1.5 text-center font-chat text-xs text-muted">
            this send holds ~{holdEstimate} cr, you have {credits}.{" "}
            <Link href="/account" className="text-foreground underline">
              top up
            </Link>
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
          {!isImage && (images.length > 0 || files.length > 0) && (
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {images.map((img, i) => (
                <div key={`img-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URIs */}
                  <img
                    src={img}
                    alt={`attachment ${i + 1}`}
                    className="h-16 w-16 rounded-md border border-border object-cover"
                  />
                  <button
                    onClick={() => onRemoveImage(i)}
                    title="remove"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-md border border-border bg-background text-xs text-muted transition-colors hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <div
                  key={`file-${i}`}
                  className="flex h-16 max-w-[10rem] items-center gap-1.5 rounded-md border border-border px-2.5"
                >
                  <span className="shrink-0 text-faint">
                    <FileIcon />
                  </span>
                  <span className="truncate font-chat text-xs text-muted">
                    {f.name}
                  </span>
                  <button
                    onClick={() => onRemoveFile(i)}
                    title="remove"
                    className="ml-auto shrink-0 text-xs text-faint transition-colors hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5">
            {imageEnabled && (
              <button
                onClick={onToggleMode}
                disabled={sending}
                title={isImage ? "switch to chat" : "generate an image"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-30 ${
                  isImage
                    ? "border-border-strong bg-surface-2 text-foreground"
                    : "border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <ImageIcon />
              </button>
            )}

            {!isImage && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || outOfCredits}
                title="attach image or text file"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
              >
                <PaperclipIcon />
              </button>
            )}

            {!isImage && dictation.supported && (
              <button
                onClick={dictation.toggle}
                disabled={outOfCredits}
                title={dictation.listening ? "stop dictation" : "dictate"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-30 ${
                  dictation.listening
                    ? "border-border-strong bg-surface-2 text-foreground"
                    : "border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <MicIcon />
              </button>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept={fileAccept}
              multiple
              onChange={(e) => {
                onFilesSelected(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />

            <textarea
              ref={ref}
              rows={1}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={
                outOfCredits
                  ? "out of credits"
                  : isImage
                    ? "describe an image to generate…"
                    : "message velum…"
              }
              disabled={outOfCredits}
              className="max-h-[200px] flex-1 resize-none bg-transparent py-2 font-chat text-[15px] leading-6 outline-none placeholder:text-faint disabled:opacity-50 focus-visible:shadow-none"
            />

            {sending ? (
              <button
                onClick={onStop}
                title="stop"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-foreground text-background transition hover:opacity-80"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!canSend}
                suppressHydrationWarning
                title={isImage ? "generate" : "send"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-foreground text-background transition hover:opacity-80 disabled:opacity-20"
              >
                {isImage ? <ImageIcon /> : <ArrowUpIcon />}
              </button>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 font-chat text-[11px] text-faint">
          <span className="flex items-center gap-2">
            {!isImage && length && onLength && (
              <LengthControl value={length} onChange={onLength} />
            )}
          </span>
          <span className="flex items-center gap-2">
            <span className="hidden sm:inline">
              {isImage
                ? "enter to generate"
                : "enter to send · shift + enter for a new line"}
            </span>
            {holdEstimate != null && (
              <span className="tabular-nums">holds ~{holdEstimate} cr</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
