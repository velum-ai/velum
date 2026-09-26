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

// File uploads (.txt, .md, .pdf): read into the prompt as text, no vision
// API involved, so every model supports them the same way. PDFs go through
// pdf-parse first; everything else is read as plain text.
export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_DATA_URL_LENGTH = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 100;
export const FILE_TYPES = ["text/plain", "text/markdown", "application/pdf"];
export const FILE_DATA_URL = new RegExp(
  `^data:(${FILE_TYPES.join("|")});base64,`,
);
// Extracted text is capped independently of upload size, a large PDF's raw
// bytes don't correlate with how much text comes out, and this is what
// actually bounds the prompt.
export const MAX_FILE_TEXT_CHARS = 50_000;

// Hard ceiling on a chat request body: MAX_IMAGES full-size data URLs plus
// MAX_FILES full-size file data URLs plus history/text slack. Requests
// declaring more are rejected before buffering.
export const MAX_REQUEST_BYTES =
  MAX_IMAGES * MAX_DATA_URL_LENGTH + MAX_FILES * MAX_FILE_DATA_URL_LENGTH + 512 * 1024;
