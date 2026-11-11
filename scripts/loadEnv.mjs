// Same `@/*` alias as loader.mjs, plus .env: for scripts that actually talk
// to the real database or external APIs (the db:*, create-account,
// grant-credit, delete-account, sync-models, import:legacy scripts).
//
// Not merged into loader.mjs itself: scripts/test.js runs through that one
// deliberately secret-free, to exercise "not configured" fallback paths
// (e.g. codeExec.js's self-check asserts codeExecConfigured() is false).
// Prisma 7's driver adapter (src/lib/prisma.js) reads process.env.DATABASE_URL
// directly with no fallback loading of its own - unlike the old schema-url
// setup, nothing else will populate it for a plain `node` invocation.
import "dotenv/config";
import "./loader.mjs";
