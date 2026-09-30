// Client-safe estimate for the composer. Deliberately rough: it mirrors the
// server's char/token heuristic and worst-case reserve so the number shown
// ("holds ~N cr") lines up with what the chat route actually holds.
import { CHARS_PER_TOKEN } from "@/lib/pricing";

// Worst-case credits the next send will hold: full input at the model's input
// rate + a full-length reply at its output rate. `model` is one row from
// /api/models ({ inputCr, outputCr } per 1M tokens); maxOutput comes with it.
export function reserveEstimate({ model, promptChars, maxOutput }) {
  if (!model) return null;
  const inTok = Math.ceil(promptChars / CHARS_PER_TOKEN);
  const cr =
    (inTok * model.inputCr) / 1e6 + (maxOutput * model.outputCr) / 1e6;
  return Math.max(1, Math.ceil(cr));
}
