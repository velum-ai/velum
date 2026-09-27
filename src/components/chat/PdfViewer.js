"use client";

import { useEffect, useRef, useState } from "react";

// A minimal, self-styled PDF renderer so the preview matches the app instead
// of the browser's own PDF UI (toolbar, page-fit controls, print button...).
// Renders every page to a canvas, stacked in one scrollable column, scaled to
// fit the panel's current width - resizing the panel just re-fits the pages.
const PAGE_GAP = 16;

export default function PdfViewer({ url, name }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);

  // track the panel's width, debounced so a live resize-drag doesn't
  // re-render every page on every pixel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let t;
    const ro = new ResizeObserver(([entry]) => {
      clearTimeout(t);
      t = setTimeout(() => setContainerWidth(entry.contentRect.width), 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // load the document once per url
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the new url, not derived from a render */
    setPdfDoc(null);
    setError(false);
    // Fetch the bytes ourselves rather than handing pdf.js a bare url: it
    // otherwise tries its own HTTP range-request strategy, which our
    // attachments route doesn't support, and that negotiation can fail
    // outright on a file that actually needs pdf.js's own recovery parsing
    // (a malformed xref table, still readable) instead of falling back.
    Promise.all([import("pdfjs-dist"), fetch(url).then((r) => r.arrayBuffer())])
      .then(([pdfjsLib, data]) => {
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        return pdfjsLib.getDocument({ data }).promise.then((doc) => {
          if (cancelled) return;
          setPdfDoc(doc);
          setPageCount(doc.numPages);
        });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  // render every page at a scale that fits the current width
  useEffect(() => {
    if (!pdfDoc || !containerWidth) return;
    let cancelled = false;

    (async () => {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) return;
        const canvas = containerRef.current?.querySelector(`canvas[data-page="${i}"]`);
        if (!canvas) continue;
        try {
          const page = await pdfDoc.getPage(i);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = (containerWidth - 32) / unscaled.width;
          const viewport = page.getViewport({ scale });
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          if (!cancelled) await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        } catch {
          // a single page failing to render isn't fatal to the rest
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, containerWidth]);

  // which page is currently in view, for the small counter
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !pageCount) return;
    const onScroll = () => {
      const pages = root.querySelectorAll("[data-page-wrap]");
      const top = root.scrollTop + root.clientHeight / 3;
      let current = 1;
      pages.forEach((el, i) => {
        if (el.offsetTop <= top) current = i + 1;
      });
      setVisiblePage(current);
    };
    root.addEventListener("scroll", onScroll);
    return () => root.removeEventListener("scroll", onScroll);
  }, [pageCount]);

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
    <div className="relative flex h-full flex-col">
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col items-center" style={{ gap: PAGE_GAP }}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <div key={n} data-page-wrap>
              <canvas
                data-page={n}
                className="rounded-sm border border-border bg-white shadow-sm"
              />
            </div>
          ))}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface-2/90 px-2.5 py-1 font-chat text-xs text-muted backdrop-blur">
          {visiblePage} / {pageCount}
        </div>
      )}
    </div>
  );
}
