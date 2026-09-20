// The credit system.
//
// 100 credits = $1.00, always (USD_PER_CREDIT). A message is billed on the
// tokens it actually used: OpenRouter's token price for that model, multiplied
// by MARGIN. The markup covers OpenRouter's ~5% fee, Dodo's payment/tax fees on
// the top-up, credits refunded on cancelled replies, and hosting, with a small
// margin left over. 1.4 = +40% over provider cost.

export const USD_PER_CREDIT = 0.01;

export const MARGIN = (() => {
  const m = Number(process.env.LLM_MARGIN);
  return Number.isFinite(m) && m >= 1 ? m : 1.4;
})();

export const MAX_OUTPUT = Number(process.env.MAX_OUTPUT_TOKENS) || 4000;

// Per-request reply length. The reservation always holds the worst case
// (MAX_OUTPUT); this only lowers the upstream cap, so shorter replies just
// settle cheaper. "detailed" is the ceiling.
export const LENGTHS = ["concise", "balanced", "detailed"];
export const outputCapFor = (length) => {
  if (length === "concise") return Math.min(900, MAX_OUTPUT);
  if (length === "detailed") return MAX_OUTPUT;
  return Math.min(2200, MAX_OUTPUT); // balanced (default)
};

// The models a user can pick, grouped for the picker and pricing page. Ids are
// OpenRouter `provider/model` slugs; `inUsd`/`outUsd` are OpenRouter's price in
// USD per 1,000,000 tokens. After editing this list run `npm run sync-models`
// to refresh the prices, then paste the output back here. `default: true` is
// the tier's starting pick set; an account with no customization gets exactly
// those (see account.resolveEnabledModels). Anything else in the tier is
// opt-in from /account.
export const TIERS = ["efficient", "flagship", "coding", "vision", "longContext", "uncensored"];

export const TIER_LABELS = {
  efficient: "efficient",
  flagship: "flagship",
  coding: "coding",
  vision: "vision",
  longContext: "long context",
  uncensored: "uncensored",
};

export const MODELS = {
  // efficient: cheap and fast, fine for everyday use
  "openai/gpt-5.4-nano": { inUsd: 0.2, outUsd: 1.25, tier: "efficient", default: true },
  "google/gemini-2.5-flash-lite": { inUsd: 0.1, outUsd: 0.4, tier: "efficient", default: true },
  "deepseek/deepseek-v4-flash": { inUsd: 0.0886, outUsd: 0.1772, tier: "efficient", default: true },
  "openai/gpt-5.6-luna": { inUsd: 0.2, outUsd: 1.2, tier: "efficient", default: true },
  "meta-llama/llama-3.3-70b-instruct": { inUsd: 0.1, outUsd: 0.32, tier: "efficient", default: true },
  "mistralai/mistral-small-3.2-24b-instruct": { inUsd: 0.075, outUsd: 0.2, tier: "efficient", default: false },
  "qwen/qwen3-30b-a3b-instruct-2507": { inUsd: 0.048, outUsd: 0.193, tier: "efficient", default: false },
  "google/gemma-3-27b-it": { inUsd: 0.08, outUsd: 0.45, tier: "efficient", default: false },

  // flagship: top quality, higher cost
  "anthropic/claude-opus-5": { inUsd: 5, outUsd: 25, tier: "flagship", default: true },
  "anthropic/claude-sonnet-5": { inUsd: 2, outUsd: 10, tier: "flagship", default: true },
  "openai/gpt-5.5": { inUsd: 5, outUsd: 30, tier: "flagship", default: true },
  "google/gemini-2.5-pro": { inUsd: 1.25, outUsd: 10, tier: "flagship", default: true },
  "x-ai/grok-4.6": { inUsd: 2, outUsd: 6, tier: "flagship", default: true },
  "anthropic/claude-haiku-4.5": { inUsd: 1, outUsd: 5, tier: "flagship", default: false },
  "google/gemini-3.5-flash": { inUsd: 1.5, outUsd: 9, tier: "flagship", default: false },

  // coding: built for or tuned on code
  "openai/gpt-5.3-codex": { inUsd: 1.75, outUsd: 14, tier: "coding", default: true },
  "qwen/qwen3-coder-plus": { inUsd: 0.65, outUsd: 3.25, tier: "coding", default: true },
  "mistralai/codestral-2508": { inUsd: 0.3, outUsd: 0.9, tier: "coding", default: true },
  "moonshotai/kimi-k2.7-code": { inUsd: 0.71, outUsd: 3.5, tier: "coding", default: true },
  "deepseek/deepseek-v4-pro": { inUsd: 1.6, outUsd: 3.2, tier: "coding", default: true },
  "openai/gpt-5.1-codex-mini": { inUsd: 0.25, outUsd: 2, tier: "coding", default: false },
  "qwen/qwen3-coder": { inUsd: 0.3, outUsd: 1, tier: "coding", default: false },
  "z-ai/glm-4.7": { inUsd: 0.4, outUsd: 1.75, tier: "coding", default: false },

  // vision: strong on image input
  "google/gemini-2.5-flash": { inUsd: 0.3, outUsd: 2.5, tier: "vision", default: true },
  "openai/gpt-4o": { inUsd: 2.5, outUsd: 10, tier: "vision", default: true },
  "qwen/qwen3-vl-235b-a22b-instruct": { inUsd: 0.21, outUsd: 1.9, tier: "vision", default: true },
  "z-ai/glm-4.6v": { inUsd: 0.3, outUsd: 0.9, tier: "vision", default: true },
  "google/gemini-3.1-flash-lite": { inUsd: 0.25, outUsd: 1.5, tier: "vision", default: true },
  "openai/gpt-4.1-mini": { inUsd: 0.4, outUsd: 1.6, tier: "vision", default: false },
  "qwen/qwen3-vl-30b-a3b-instruct": { inUsd: 0.15, outUsd: 0.6, tier: "vision", default: false },

  // longContext: very large context windows
  "x-ai/grok-4.20": { inUsd: 1.25, outUsd: 2.5, tier: "longContext", default: true },
  "moonshotai/kimi-k3": { inUsd: 2.648, outUsd: 13.283, tier: "longContext", default: true },
  "qwen/qwen-plus": { inUsd: 0.26, outUsd: 0.78, tier: "longContext", default: true },
  "z-ai/glm-5.3": { inUsd: 1.4, outUsd: 4.4, tier: "longContext", default: true },
  "thedrummer/unslopnemo-12b": { inUsd: 0.4, outUsd: 0.4, tier: "longContext", default: true },
  "mistralai/mistral-large-2512": { inUsd: 0.5, outUsd: 1.5, tier: "longContext", default: false },
  "x-ai/grok-4.3": { inUsd: 1.25, outUsd: 2.5, tier: "longContext", default: false },

  // uncensored: minimal refusals, includes the Venice edition
  "cognitivecomputations/dolphin-mistral-24b-venice-edition": { inUsd: 0.2, outUsd: 0.9, tier: "uncensored", default: true },
  "nousresearch/hermes-4-405b": { inUsd: 1, outUsd: 3, tier: "uncensored", default: true },
  "nousresearch/hermes-3-llama-3.1-70b": { inUsd: 0.7, outUsd: 0.7, tier: "uncensored", default: true },
  "sao10k/l3.3-euryale-70b": { inUsd: 0.65, outUsd: 0.75, tier: "uncensored", default: true },
  "sao10k/l3-lunaris-8b": { inUsd: 0.04, outUsd: 0.05, tier: "uncensored", default: true },
  "nousresearch/hermes-3-llama-3.1-405b": { inUsd: 1, outUsd: 1, tier: "uncensored", default: false },
  "thedrummer/cydonia-24b-v4.1": { inUsd: 0.3, outUsd: 0.5, tier: "uncensored", default: false },
};

// Short display names for the picker and pricing page.
export const MODEL_LABELS = {
  "openai/gpt-5.4-nano": "gpt-5.4 nano",
  "google/gemini-2.5-flash-lite": "gemini flash lite",
  "deepseek/deepseek-v4-flash": "deepseek v4 flash",
  "openai/gpt-5.6-luna": "gpt-5.6 luna",
  "meta-llama/llama-3.3-70b-instruct": "llama 3.3 70b",
  "mistralai/mistral-small-3.2-24b-instruct": "mistral small 3.2",
  "qwen/qwen3-30b-a3b-instruct-2507": "qwen3 30b",
  "google/gemma-3-27b-it": "gemma 3 27b",
  "anthropic/claude-opus-5": "claude opus 5",
  "anthropic/claude-sonnet-5": "claude sonnet 5",
  "openai/gpt-5.5": "gpt-5.5",
  "google/gemini-2.5-pro": "gemini 2.5 pro",
  "x-ai/grok-4.6": "grok 4.6",
  "anthropic/claude-haiku-4.5": "claude haiku 4.5",
  "google/gemini-3.5-flash": "gemini 3.5 flash",
  "openai/gpt-5.3-codex": "gpt-5.3 codex",
  "qwen/qwen3-coder-plus": "qwen3 coder plus",
  "mistralai/codestral-2508": "codestral",
  "moonshotai/kimi-k2.7-code": "kimi k2.7 code",
  "deepseek/deepseek-v4-pro": "deepseek v4 pro",
  "openai/gpt-5.1-codex-mini": "gpt-5.1 codex mini",
  "qwen/qwen3-coder": "qwen3 coder",
  "z-ai/glm-4.7": "glm-4.7",
  "google/gemini-2.5-flash": "gemini flash",
  "openai/gpt-4o": "gpt-4o",
  "qwen/qwen3-vl-235b-a22b-instruct": "qwen3 vl 235b",
  "z-ai/glm-4.6v": "glm-4.6v",
  "google/gemini-3.1-flash-lite": "gemini 3.1 flash lite",
  "openai/gpt-4.1-mini": "gpt-4.1 mini",
  "qwen/qwen3-vl-30b-a3b-instruct": "qwen3 vl 30b",
  "x-ai/grok-4.20": "grok 4.20",
  "moonshotai/kimi-k3": "kimi k3",
  "qwen/qwen-plus": "qwen plus",
  "z-ai/glm-5.3": "glm-5.3",
  "thedrummer/unslopnemo-12b": "unslopnemo 12b",
  "mistralai/mistral-large-2512": "mistral large",
  "x-ai/grok-4.3": "grok 4.3",
  "cognitivecomputations/dolphin-mistral-24b-venice-edition": "dolphin (venice)",
  "nousresearch/hermes-4-405b": "hermes 4 405b",
  "nousresearch/hermes-3-llama-3.1-70b": "hermes 3 70b",
  "sao10k/l3.3-euryale-70b": "euryale 70b",
  "sao10k/l3-lunaris-8b": "lunaris 8b",
  "nousresearch/hermes-3-llama-3.1-405b": "hermes 3 405b",
  "thedrummer/cydonia-24b-v4.1": "cydonia 24b",
};

export function isAllowedModel(model) {
  return Object.hasOwn(MODELS, model);
}

export const modelTier = (model) => MODELS[model]?.tier || "efficient";

// The starting pick set for an account that hasn't customized its model list.
export const defaultModelIds = () =>
  Object.keys(MODELS).filter((id) => MODELS[id].default);

// --- image generation -------------------------------------------------------
// An OpenRouter model that returns an image (see upstream.generateImage).
// IMAGE_USD is the flat provider cost per image, margin applied; override it
// with the real number for whichever model IMAGE_MODEL points at.
export const IMAGE_MODEL =
  process.env.IMAGE_MODEL || "google/gemini-2.5-flash-image";
const IMAGE_USD = Number(process.env.IMAGE_USD) || 0.04;

export const imageCredits = () =>
  Math.max(1, Math.ceil((IMAGE_USD / USD_PER_CREDIT) * MARGIN));

// --- top-ups (Dodo Payments, USD) ------------------------------------------
// Credits are pegged at USD_PER_CREDIT, so N credits cost N * USD_PER_CREDIT.
// Dodo charges in the lowest denomination (cents). Purchases are clamped to
// [MIN, MAX] and, to map cleanly onto the Dodo product, must be a whole number
// of units (see dodo.CREDITS_PER_UNIT).
export const MIN_PURCHASE_CREDITS = 100;
export const MAX_PURCHASE_CREDITS = 100_000;

export const centsForCredits = (credits) =>
  Math.round(credits * USD_PER_CREDIT * 100);

export const isValidPurchase = (credits) =>
  Number.isInteger(credits) &&
  credits >= MIN_PURCHASE_CREDITS &&
  credits <= MAX_PURCHASE_CREDITS &&
  credits % 100 === 0;

export function estimateInputTokens(text) {
  return Math.ceil((text?.length || 0) / 4);
}

// Credits charged per 1M tokens at a given USD/1M rate, margin applied.
export const creditsPerMillion = (usd) =>
  Math.round((usd / USD_PER_CREDIT) * MARGIN);

// Providers pass prompt-cache hits through when available; bill cached input at
// ~10% instead of overcharging on long chats.
const CACHED_INPUT_DISCOUNT = 0.1;

function costCredits(model, promptTok, completionTok, cachedTok = 0) {
  const { inUsd, outUsd } = MODELS[model];
  const fresh = Math.max(0, promptTok - cachedTok);
  const usd =
    (fresh * inUsd +
      cachedTok * inUsd * CACHED_INPUT_DISCOUNT +
      completionTok * outUsd) /
    1e6;
  return Math.max(1, Math.ceil((usd / USD_PER_CREDIT) * MARGIN));
}

export function worstCaseCredits(model, text) {
  return costCredits(model, estimateInputTokens(text), MAX_OUTPUT);
}

export function usageToCredits(model, usage) {
  return costCredits(
    model,
    usage?.prompt_tokens || 0,
    usage?.completion_tokens || 0,
    usage?.prompt_tokens_details?.cached_tokens || 0,
  );
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("pricing.js")) {
  const { default: a } = await import("node:assert");
  const [firstModel] = Object.keys(MODELS);

  a.ok(isAllowedModel(firstModel));
  a.ok(!isAllowedModel("__proto__"));
  a.ok(MARGIN >= 1);
  a.ok(worstCaseCredits(firstModel, "hello world") > 0);
  a.strictEqual(creditsPerMillion(1), Math.round(100 * MARGIN));

  const low = usageToCredits(firstModel, { prompt_tokens: 100, completion_tokens: 100 });
  const high = usageToCredits(firstModel, { prompt_tokens: 5000, completion_tokens: 5000 });
  a.ok(high > low);
  a.strictEqual(usageToCredits(firstModel, {}), 1);

  const fresh = usageToCredits(firstModel, { prompt_tokens: 200_000, completion_tokens: 0 });
  const cached = usageToCredits(firstModel, {
    prompt_tokens: 200_000,
    completion_tokens: 0,
    prompt_tokens_details: { cached_tokens: 180_000 },
  });
  a.ok(cached < fresh);

  a.ok(imageCredits() >= 1);
  a.strictEqual(
    imageCredits(),
    Math.max(1, Math.ceil((IMAGE_USD / USD_PER_CREDIT) * MARGIN)),
  );

  a.ok(outputCapFor("concise") <= outputCapFor("balanced"));
  a.ok(outputCapFor("balanced") <= outputCapFor("detailed"));
  a.strictEqual(outputCapFor("detailed"), MAX_OUTPUT);
  a.strictEqual(outputCapFor("anything-else"), outputCapFor("balanced"));

  const defaults = defaultModelIds();
  a.ok(defaults.length > 0 && defaults.length < Object.keys(MODELS).length);
  a.ok(defaults.every(isAllowedModel));
  for (const id of Object.keys(MODELS)) a.ok(TIERS.includes(MODELS[id].tier), id);
  for (const id of Object.keys(MODELS)) a.ok(MODEL_LABELS[id], `missing label: ${id}`);

  console.log("pricing.js self-check OK");
}
