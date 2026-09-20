// Print an up-to-date MODELS table from the provider's live catalogue, for the
// ids currently in pricing.js. Only OpenRouter returns pricing, so set
// UPSTREAM_BASE_URL=https://openrouter.ai/api/v1 first. Paste the output into
// src/lib/pricing.js.
//
//   UPSTREAM_BASE_URL=... UPSTREAM_API_KEY=... npm run sync-models
import { fetchModelCatalogue } from "@/lib/upstream";
import { MODELS } from "@/lib/pricing";

const catalogue = await fetchModelCatalogue();
const byId = new Map(catalogue.map((m) => [m.id, m]));

console.log("export const MODELS = {");
for (const id of Object.keys(MODELS)) {
  const m = byId.get(id);
  if (!m?.pricing) {
    console.log(`  // ${id}: not found in catalogue`);
    continue;
  }
  const inUsd = +(Number(m.pricing.prompt) * 1e6).toFixed(4);
  const outUsd = +(Number(m.pricing.completion) * 1e6).toFixed(4);
  console.log(`  "${id}": { inUsd: ${inUsd}, outUsd: ${outUsd} },`);
}
console.log("};");
process.exit(0);
