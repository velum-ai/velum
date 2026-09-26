"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ThemeToggle from "@/components/ThemeToggle";
import {
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  TrashIcon,
  ArrowLeftIcon,
} from "@/components/chat/icons";
import { api } from "@/lib/clientApi";
import { STORAGE_KEY } from "@/lib/limits";
import { MODELS, MODEL_LABELS, TIERS, TIER_LABELS } from "@/lib/pricing";

// Entirely client-fetched (account number lives in localStorage, never on the
// server); a cached static shell buys nothing here and dev-mode was serving a
// stale one after edits to this file, tripping hydration mismatches on the
// disabled-state buttons. Force a fresh render every request.
export const dynamic = "force-dynamic";

const PACKS = [100, 500, 1000, 2500, 5000];

const MODELS_BY_TIER = TIERS.map((tier) => ({
  tier,
  ids: Object.keys(MODELS).filter((id) => MODELS[id].tier === tier),
}));

function maskNumber(n) {
  const d = String(n).replace(/\s/g, "");
  return (
    d
      .split("")
      .map((c, i) => (i < 4 || i >= d.length - 4 ? c : "•"))
      .join("")
      .match(/.{1,4}/g)
      ?.join(" ") ?? d
  );
}

function Sparkbars({ daily }) {
  const days = [];
  const today = new Date();
  const map = Object.fromEntries(daily.map((r) => [r.d, Number(r.cr)]));
  for (let i = 29; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    days.push({ key, cr: map[key] || 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.cr));

  return (
    <div className="flex h-20 items-end gap-[3px]">
      {days.map((d) => (
        <div
          key={d.key}
          title={`${d.key}: ${d.cr} cr`}
          className="flex-1 rounded-sm bg-border-strong transition-colors hover:bg-foreground"
          style={{ height: `${Math.max(2, (d.cr / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const Card = ({ label, children }) => (
  <section className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:p-5">
    {label && (
      <span className="text-xs uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    )}
    {children}
  </section>
);

const Ghost = (props) => (
  <button
    {...props}
    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
  />
);

// icon-only square variant, same border treatment
const IconGhost = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground"
  >
    {children}
  </button>
);

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [data, setData] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [promptState, setPromptState] = useState("idle");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [added, setAdded] = useState(0);
  const [method, setMethod] = useState("dodo");

  const setBalance = (credits) => setData((d) => (d ? { ...d, credits } : d));

  // Once the user touches model toggles, a slower/duplicate initial overview
  // fetch landing late must not clobber their edit with the pre-edit list.
  const modelsEdited = useRef(false);

  const toggleModel = async (id) => {
    modelsEdited.current = true;
    const current = data?.enabledModels || [];
    const next = current.includes(id)
      ? current.filter((m) => m !== id)
      : [...current, id];
    if (next.length === 0) return; // at least one model must stay enabled
    setData((d) => (d ? { ...d, enabledModels: next } : d));
    const { ok, data: res } = await api("/api/account", {
      method: "PATCH",
      body: { account, enabledModels: next },
    });
    if (ok && res.enabledModels) {
      setData((d) => (d ? { ...d, enabledModels: res.enabledModels } : d));
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      router.replace("/login");
      return;
    }
    setAccount(stored);
    api("/api/account/overview", { body: { account: stored } }).then(({ ok, status, data }) => {
      if (!ok) {
        if (status === 400) {
          localStorage.removeItem(STORAGE_KEY);
          router.replace("/login");
        }
        return;
      }
      setData((d) =>
        modelsEdited.current ? { ...data, enabledModels: d?.enabledModels } : data,
      );
      setPrompt(data.systemPrompt || "");
      setSavedPrompt(data.systemPrompt || "");
    });

    // returning from a checkout: ?payment_id=... (Dodo) or ?btcpay_invoice=... (BTCPay)
    const q = new URLSearchParams(window.location.search);
    const paymentId = q.get("payment_id");
    const btcpayInvoiceId = q.get("btcpay_invoice");
    if (paymentId || btcpayInvoiceId) {
      window.history.replaceState({}, "", "/account");
      setBuying(true);
      api("/api/payments/verify", { body: { account: stored, paymentId, btcpayInvoiceId } }).then(
        ({ ok, data }) => {
          setBuying(false);
          if (ok && data.ok) {
            if (typeof data.balance === "number") setBalance(data.balance);
            setAdded(data.granted || 0);
          } else if (data?.pending) {
            setBuyError("payment is processing, your balance will update shortly");
          } else {
            setBuyError("could not confirm the payment");
          }
        },
      );
    }
  }, [router]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const savePrompt = async () => {
    setPromptState("saving");
    const { ok, data: res } = await api("/api/account", {
      method: "PATCH",
      body: { account, systemPrompt: prompt },
    });
    if (ok) {
      setSavedPrompt(res.systemPrompt || "");
      setPromptState("saved");
      setTimeout(() => setPromptState("idle"), 1500);
    } else {
      setPromptState("idle");
    }
  };

  const buy = async (credits) => {
    setBuying(true);
    setBuyError("");
    setAdded(0);

    const { ok, status, data } = await api("/api/payments", {
      body: { account, credits, method },
    });
    if (!ok || !data.checkoutUrl) {
      setBuying(false);
      setBuyError(
        status === 429
          ? "too many attempts, try again later"
          : data.error || "could not start payment",
      );
      return;
    }
    // hand off to the provider's hosted checkout; they redirect back to /account
    window.location.assign(data.checkoutUrl);
  };

  const runWipe = async () => {
    setBusy(true);
    const target = confirm;
    const { ok } = await api("/api/account/wipe", { body: { account, target } });
    setBusy(false);
    setConfirm(null);
    if (!ok) return;
    if (target === "account") {
      localStorage.removeItem(STORAGE_KEY);
      router.push("/");
    } else {
      setData((d) => (d ? { ...d, stats: { ...d.stats, chats: 0 } } : d));
    }
  };

  const exportData = async () => {
    if (!account) return;
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account }),
      });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `velum-${String(account).replace(/\D/g, "").slice(-4)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const created = data?.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "…";

  const stat = (label, value) => (
    <div className="flex flex-col">
      <span className="text-lg tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-1 flex items-center gap-3">
          <button
            onClick={() => {
              // prefer returning to the exact chat the user came from over
              // always landing on the generic /chat route
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/chat");
              }
            }}
            title="back to chat"
            aria-label="back to chat"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <ArrowLeftIcon />
          </button>
          <h1 className="flex-1 text-xl font-medium tracking-tight sm:text-2xl">
            account
          </h1>
          <ThemeToggle />
        </div>

        {/* identity + balance */}
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-[0.12em] text-faint">
                account number
              </span>
              {account ? (
                <span className="font-mono text-base tracking-[0.14em] text-foreground sm:text-lg">
                  {revealed ? account : maskNumber(account)}
                </span>
              ) : (
                <span className="sk h-5 w-44" />
              )}
              <div className="mt-1 flex gap-1.5">
                <IconGhost
                  title={revealed ? "hide" : "reveal"}
                  onClick={() => setRevealed((v) => !v)}
                >
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </IconGhost>
                <IconGhost title={copied ? "copied" : "copy"} onClick={copy}>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </IconGhost>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:items-end">
              <span className="text-xs uppercase tracking-[0.12em] text-faint">
                balance
              </span>
              {data ? (
                <span className="text-2xl tabular-nums text-foreground">
                  {data.credits.toLocaleString()}
                  <span className="ml-1 text-sm text-muted">cr</span>
                </span>
              ) : (
                <span className="sk h-7 w-20" />
              )}
              {data ? (
                <span className="text-xs text-faint">created {created}</span>
              ) : (
                <span className="sk h-3 w-24" />
              )}
            </div>
          </div>
        </Card>

        {/* add credit */}
        <Card label="add credit">
          <span className="-mt-1 text-xs text-faint">100 credits = $1.00.</span>
          {data?.methods?.btcpay && (
            <span className="flex w-fit overflow-hidden rounded-md border border-border">
              {[
                { id: "dodo", label: "card & more" },
                { id: "btcpay", label: "monero" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`px-3 py-1 text-xs transition-colors ${
                    method === m.id
                      ? "bg-surface-2 text-foreground"
                      : "text-faint hover:text-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </span>
          )}
          {added > 0 && (
            <p className="rounded-md border border-border px-3 py-2 text-sm">
              added {added.toLocaleString()} credits.
            </p>
          )}
          {buyError && <p className="text-sm text-muted">{buyError}</p>}
          <div className="flex flex-wrap gap-2">
            {PACKS.map((c) => (
              <button
                key={c}
                onClick={() => buy(c)}
                disabled={buying || !account}
                suppressHydrationWarning
                className="flex flex-1 items-baseline justify-center gap-1.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="tabular-nums text-foreground">
                  {c.toLocaleString()}
                </span>
                <span className="text-xs text-muted">${(c / 100).toFixed(2)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">
            {buying
              ? "opening checkout…"
              : method === "btcpay"
                ? "monero invoice, no processor in the middle."
                : "secure checkout by dodo payments, card, apple pay, google pay, bank transfer and more."}
          </p>
        </Card>

        {/* usage + history */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {!data ? (
              <Card label="usage">
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <span className="sk h-5 w-12" />
                      <span className="sk h-3 w-16" />
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card label="usage">
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  {stat("chats", data.stats.chats.toLocaleString())}
                  {stat("replies", data.stats.messages.toLocaleString())}
                  {stat("credits spent", data.stats.spent.toLocaleString())}
                </div>

                {data.stats.spent > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <span className="text-xs text-muted">last 30 days</span>
                    <Sparkbars daily={data.daily} />
                  </div>
                )}

                {data.byModel.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">by model</span>
                    {data.byModel.map((row) => {
                      const top = data.byModel[0].spent || 1;
                      return (
                        <div key={row.model} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 truncate text-sm text-muted">
                            {MODEL_LABELS[row.model] || row.model}
                          </span>
                          <span
                            className="h-1.5 rounded-sm bg-border-strong"
                            style={{ width: `${(row.spent / top) * 100}%` }}
                          />
                          <span className="text-xs tabular-nums text-faint">
                            {row.spent.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>

          {data && data.payments.length > 0 && (
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Card label="top-ups">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[280px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="py-2 pr-4 font-medium">date</th>
                        <th className="py-2 pr-4 font-medium">credits</th>
                        <th className="py-2 font-medium">paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-2 pr-4 text-muted">
                            {p.paidAt
                              ? new Date(p.paidAt).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {p.credits.toLocaleString()}
                          </td>
                          <td className="py-2 tabular-nums text-muted">
                            ${(p.amountCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* custom instructions */}
        <Card label="custom instructions">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. answer concisely. i am a software engineer."
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 font-chat text-sm leading-6 outline-none focus:border-border-strong"
          />
          <div className="flex items-center gap-3">
            <Ghost
              onClick={savePrompt}
              disabled={promptState === "saving" || prompt === savedPrompt}
            >
              {promptState === "saving"
                ? "saving..."
                : promptState === "saved"
                  ? "saved"
                  : "save"}
            </Ghost>
            <span className="text-xs tabular-nums text-faint">
              {prompt.length} / 2000
            </span>
          </div>
        </Card>

        {/* models */}
        <Card label="models">
          <span className="-mt-1 text-xs text-faint">
            which models show up in the chat menu. at least one must stay on.
          </span>
          {MODELS_BY_TIER.map(({ tier, ids }) => (
            <div key={tier} className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-[0.12em] text-faint">
                {TIER_LABELS[tier]}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ids.map((id) => {
                  const on = (data?.enabledModels || []).includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleModel(id)}
                      disabled={!data}
                      suppressHydrationWarning
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                        on
                          ? "border-border-strong bg-surface-2 text-foreground"
                          : "border-border text-faint hover:text-muted"
                      }`}
                    >
                      {MODEL_LABELS[id] || id}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        {/* data controls */}
        <Card label="data controls">
          <div className="flex flex-wrap gap-2">
            <Ghost onClick={exportData} disabled={exporting || !account} suppressHydrationWarning>
              <DownloadIcon />
              {exporting ? "preparing..." : "download my data"}
            </Ghost>
            <Ghost onClick={() => setConfirm("chats")}>
              <TrashIcon />
              delete all chats
            </Ghost>
            <button
              onClick={() => setConfirm("account")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              <TrashIcon />
              delete account
            </button>
          </div>
        </Card>
      </main>

      <ConfirmDialog
        open={confirm === "chats"}
        title="delete all chats?"
        body="every thread and its messages are removed. your balance is untouched. this cannot be undone."
        confirmLabel="delete all chats"
        busy={busy}
        onConfirm={runWipe}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "account"}
        title="delete account?"
        body="the account number, all chats and any remaining balance are permanently deleted. there is no recovery."
        confirmLabel="delete account"
        phrase="delete"
        busy={busy}
        onConfirm={runWipe}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
