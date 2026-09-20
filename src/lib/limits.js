// Constants shared by server routes and client pages - single source so the
// two sides can't drift.

export const DEFAULT_MODEL = "openai/gpt-5.4-nano"; // cheapest priced tier
export const STORAGE_KEY = "velum_account";

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// server cap derived from the client byte cap: base64 inflates 4/3, plus
// slack for the data-url header
export const MAX_DATA_URL_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const IMAGE_DATA_URL = new RegExp(
  `^data:(${IMAGE_TYPES.join("|")});base64,`,
);

// Hard ceiling on a chat request body: MAX_IMAGES full-size data URLs plus
// history/text slack. Requests declaring more are rejected before buffering.
export const MAX_REQUEST_BYTES = MAX_IMAGES * MAX_DATA_URL_LENGTH + 512 * 1024;
