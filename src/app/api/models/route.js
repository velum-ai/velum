import { NextResponse } from "next/server";
import {
  MODELS,
  MODEL_LABELS,
  TIERS,
  creditsPerMillion,
  MARGIN,
  MAX_OUTPUT,
  imageCredits,
} from "@/lib/pricing";
import { imageConfigured } from "@/lib/upstream";
import { resolveEnabledModels } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";


// The models this account may pick in the chat composer: pricing.js's
// catalogue filtered to the account's enabled set (its customization, or the
// catalogue's defaults). The chat route independently re-checks isAllowedModel,
// so this is a UI filter, not the enforcement point.
export async function POST(req) {
  const { account } = await req.json().catch(() => ({}));
  const g = await guardRequest(req, {
    key: "models",
    limit: 30,
    windowMs: 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const enabled = await resolveEnabledModels(account);
  if (!enabled) return bad("invalid account", 400);

  const models = enabled
    .map((id) => {
      const rate = MODELS[id];
      return (
        rate && {
          id,
          label: MODEL_LABELS[id] || id,
          tier: rate.tier || "efficient",
          inputCr: creditsPerMillion(rate.inUsd),
          outputCr: creditsPerMillion(rate.outUsd),
        }
      );
    })
    .filter(Boolean)
    .sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));

  return NextResponse.json({
    models,
    tiers: TIERS,
    multiplier: MARGIN,
    maxOutput: MAX_OUTPUT,
    image: imageConfigured() ? { credits: imageCredits() } : null,
  });
}
