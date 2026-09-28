"use client";

import { useEffect, useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/chat/icons";

// File extension -> highlight.js language name. Anything not listed falls
// back to hljs's own auto-detection.
const EXT_LANG = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  sh: "bash",
  html: "xml",
  css: "css",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  java: "java",
  c: "c",
  cpp: "cpp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  json: "json",
  md: "markdown",
  csv: "plaintext",
  txt: "plaintext",
  log: "plaintext",
};

const langFor = (name) => EXT_LANG[name?.split(".").pop()?.toLowerCase()] || null;

// highlight.js's own name for a grammar isn't always what a user expects to
// see (its markup grammar is internally called "xml", covering html too), so
// the header label is keyed by the file's own extension, not the grammar name.
const EXT_LABEL = { html: "html" };
const labelFor = (name, lang) => EXT_LABEL[name?.split(".").pop()?.toLowerCase()] || lang;

// Minimal syntax-highlighted text viewer for anything run_python hands back
// that isn't a PDF or an image: code, csv, json, plain text. Renders with
// the same header-bar look as fenced code blocks in chat replies.
export default function CodeViewer({ url, name }) {
  const [text, setText] = useState(null);
  const [html, setHtml] = useState("");
  const [lang, setLang] = useState("");
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the new url */
    setText(null);
    setError(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (text == null) return;
    let cancelled = false;
    import("highlight.js").then(({ default: hljs }) => {
      if (cancelled) return;
      const wanted = langFor(name);
      const result =
        wanted && wanted !== "plaintext" && hljs.getLanguage(wanted)
          ? hljs.highlight(text, { language: wanted })
          : hljs.highlightAuto(text);
      setHtml(result.value);
      setLang(wanted && wanted !== "plaintext" ? wanted : result.language || "text");
    });
    return () => {
      cancelled = true;
    };
  }, [text, name]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked - nothing else to do
    }
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-chat text-sm text-muted">couldn&apos;t preview {name}</p>
        <a href={url} download={name} className="text-sm text-foreground underline">
          download it instead
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5">
        <span className="font-mono text-[11px] text-faint">{labelFor(name, lang)}</span>
        {text != null && (
          <button
            onClick={copy}
            title="copy"
            className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-surface hover:text-foreground"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
      </div>
      <pre className="m-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
