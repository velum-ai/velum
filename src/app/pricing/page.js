import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  MODELS,
  MODEL_LABELS,
  TIERS,
  TIER_LABELS,
  creditsPerMillion,
  MARGIN,
  MAX_OUTPUT,
} from "@/lib/pricing";

export const metadata = { title: "pricing" };

const pct = Math.round((MARGIN - 1) * 100);

const groups = TIERS.map((tier) => ({
  label: TIER_LABELS[tier] || tier,
  rows: Object.entries(MODELS)
    .filter(([, r]) => (r.tier || "efficient") === tier)
    .map(([id, r]) => ({
      label: MODEL_LABELS[id] || id,
      input: creditsPerMillion(r.inUsd),
      output: creditsPerMillion(r.outUsd),
    })),
})).filter((g) => g.rows.length);

const points = [
  {
    title: "prepaid, no subscription",
    body: "100 credits = $1.00, always. add credit up front, spend it per message, top up when it runs low. unused credit never expires.",
  },
  {
    title: "billed on real usage",
    body: `each reply first holds worst-case credits (a full ${MAX_OUTPUT.toLocaleString()}-token answer), then refunds everything it did not use. a cancelled reply refunds the same way. minimum 1 credit per message.`,
  },
  {
    title: `where the +${pct}% goes`,
    body: `the rates above are openrouter's token price for each model times ${MARGIN}. that covers openrouter's own fee, the payment and tax fees charged on your top-up, credits refunded on cancelled replies, and hosting. nothing is added to the 100 credits = $1.00 rate itself.`,
  },
];

export default function PricingPage() {
  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium tracking-tight sm:text-4xl">
            pricing
          </h1>
          <p className="leading-7 text-muted">
            billed in credits, per million tokens. 100 credits = $1.00.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[360px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-3 font-medium">model</th>
                <th className="px-4 py-3 font-medium">input / 1M</th>
                <th className="px-4 py-3 font-medium">output / 1M</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.label}>
                <tr className="border-b border-border bg-surface">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-xs uppercase tracking-[0.14em] text-faint"
                  >
                    {g.label}
                  </td>
                </tr>
                {g.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.input.toLocaleString()} cr
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.output.toLocaleString()} cr
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <section className="flex flex-col border-t border-border">
          {points.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-2 border-b border-border py-5"
            >
              <h2 className="text-base font-medium">{p.title}</h2>
              <p className="max-w-2xl leading-7 text-muted">{p.body}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </>
  );
}
