// Runs the pure-function self-checks (no database needed).
//
//   npm test
import { spawnSync } from "node:child_process";

const FILES = [
  "sse.js",
  "markdown.js",
  "pricing.js",
  "upstream.js",
  "sign.js",
  "httpRetry.js",
  "dodo.js",
  "btcpay.js",
  "crypto.js",
  "xConversions.js",
  "redditConversions.js",
];

let failed = 0;
for (const file of FILES) {
  const res = spawnSync(
    process.execPath,
    ["--import", "./scripts/loader.mjs", `src/lib/${file}`],
    { stdio: "inherit" },
  );
  if (res.status !== 0) {
    failed += 1;
    console.error(`FAIL: ${file}`);
  }
}

process.exit(failed ? 1 : 0);
