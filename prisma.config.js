import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 stopped auto-loading .env for the CLI, so we load it ourselves
// before calling defineConfig.
//
// Prisma 7 moved datasource URLs out of schema.prisma. This is the CLI side
// only (migrate, studio, db:sql) - it always wants a real session, so it
// uses DIRECT_URL (the Supabase "Session" pooler, port 5432), same as
// schema.prisma's old `directUrl` did. The runtime client's own connection
// (the "Transaction" pooler, port 6543) is configured separately via the
// pg adapter in src/lib/prisma.js - these two are deliberately not the same
// URL, see that file and README.
//
// Deliberately NOT using config's env() helper here, which throws if the
// var is missing: `prisma generate` runs on every `npm install`
// (postinstall) and every image build, in places that only have the schema
// on disk and no real secrets (the Docker `deps`/`builder` stages build the
// image with no DATABASE_URL/DIRECT_URL at all; those are injected only
// when a container actually runs, per docker-compose.yml). `generate` never
// needs a working URL, only `migrate`/`studio` do, and those already fail
// with a clear connection error on their own if DIRECT_URL is genuinely
// missing - no need for this file to fail earlier or more obscurely.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
