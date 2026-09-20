import { logError } from "@/lib/logger";

// Last-resort process-level handlers. Split into its own module (instead of
// living directly in instrumentation.js) so Turbopack's Edge-runtime bundle
// never has to statically see process.on/process.exit, those APIs don't
// exist there and trip a build warning even behind a runtime guard.
export function installProcessSafety() {
  // A rejected promise nobody awaited: log it, keep serving other requests.
  // Not fatal on its own, but worth knowing about.
  process.on("unhandledRejection", (reason) => {
    logError("unhandled_rejection", reason instanceof Error ? reason : new Error(String(reason)));
  });

  // A genuinely uncaught throw leaves the process in an undefined state.
  // Log it and exit; docker-compose's `restart: unless-stopped` brings a
  // clean process back up rather than limping on with corrupted state.
  process.on("uncaughtException", (err) => {
    logError("uncaught_exception", err);
    process.exit(1);
  });
}
