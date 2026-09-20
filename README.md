# Velum

Prepaid LLM chat. An account is a random 16-digit number, nothing else, credit
is bought up front, and every message is metered by token usage. No email,
password, or name is ever collected.

Next.js 16 (App Router), React 19, Tailwind 4, Postgres via Prisma. Chat and
image generation both run through OpenRouter.

## How it works

`POST /api/account` mints the number and that's the whole signup. Signing in
later is submitting that number back into a signed cookie
(`POST /api/account/lookup`); there's no password to check.

Every API route passes through `src/lib/guard.js` first: per-IP rate limit,
then a uniform account lookup (a wrong number and a rate-limited request look
the same to the caller, no account oracle). A chat message then goes through
`src/lib/exchange.js`, which is the actual money path: hold worst-case credits
for the model's max output in a `Reservation`, stream the reply from
`src/lib/upstream.js` (OpenRouter, or any OpenAI-compatible endpoint via env),
settle the reservation to real usage once the stream ends (or a character
estimate if it's aborted), and persist the pair as one `Exchange`. If the
process dies mid-reservation, `sweepReservations` refunds it on the next
startup or its 10-minute sweep, so a crash never bills for a reply nobody got.

`CONTEXT.md` has the domain glossary (Account, Credit, Reservation, Settle,
Exchange, Chat) if a term here is unfamiliar.

| path | responsibility |
| --- | --- |
| `prisma/schema.prisma` | data model and migrations |
| `src/lib/prisma.js` | Prisma client, abandoned-reservation sweep |
| `src/lib/account.js` | accounts, credits, chats, exchange and payment transactions |
| `src/lib/pricing.js` | credit math, model rate table, margin |
| `src/lib/upstream.js` | the provider wire format |
| `src/lib/dodo.js` | Dodo checkout, payment lookup, webhook signature |
| `src/lib/btcpay.js` | BTCPay invoice, invoice lookup, webhook signature |
| `src/lib/rateLimit.js` | durable fixed-window limiter, client IP |
| `src/lib/guard.js` | the admission check every API route runs first |
| `src/lib/exchange.js` | the SSE money path of one exchange |
| `src/lib/maintenance.js` | periodic sweep and prune, started from instrumentation |

## Quickstart

```bash
cp .env.example .env          # DATABASE_URL, OPENROUTER_API_KEY, APP_SECRET
npm ci
npm run db:migrate            # apply migrations
npm run dev                   # http://localhost:3000
```

```bash
npm test        # pure-function self-checks
npm run lint
```

## Self-hosting

```bash
cp .env.production.example .env   # fill it in, see notes in the file
npm run db:migrate                # against the production DATABASE_URL
docker compose up -d --build
```

`.env.production.example` lists exactly what a live deploy needs: the same
`DATABASE_URL` / `DIRECT_URL` / `OPENROUTER_API_KEY` / `APP_SECRET` as dev,
plus `NEXT_PUBLIC_SITE_URL`, `DODO_MODE=live`, and the three Dodo **live**
dashboard values. See Database below for the pooler split.

Compose runs `velum` only (non-root, healthchecked on `/api/health`, bound to
`127.0.0.1:8293`). Put your own reverse proxy in front for TLS; the database
is external. Run migrations from your machine, or
`docker compose run --rm --profile migrate migrate`.

Baseline security headers and CSP are set in `next.config.mjs`; the proxy may
override them. Rate limiting keys off `CF-Connecting-IP` with an
`x-forwarded-for` fallback, so keep the origin reachable only through the
proxy.

## Database (Supabase)

Two connection strings, both required:

- `DATABASE_URL`, the **transaction pooler** (port 6543,
  `?pgbouncer=true&connection_limit=5`). The app runs on this; it multiplexes,
  so any number of workers never hit the free tier's 15-client session limit.
  `connection_limit` only bounds this one process's own pool, raise it if
  queries that should run concurrently are queuing behind each other instead
  of overlapping. `pgbouncer=true` (disables prepared-statement caching,
  required for transaction-mode pgbouncer) is what actually keeps this pooler
  mode safe, not a low connection count.
- `DIRECT_URL`, the **session pooler** (port 5432). `prisma migrate` uses
  this; the transaction pooler cannot run migrations.

The direct `db.<ref>.supabase.co` host is IPv6-only and won't connect from
most hosts, so use the pooler hostnames for both. Apply the schema with
`npm run db:migrate`, or paste `prisma/full-schema.sql` into the Supabase SQL
editor against an empty database, not as partial snippets, the tables have
foreign keys and must be created together.

## Accounts

Signup is rate limited per IP (5/hour, 20/day). There is no free tier.
Cloudflare Turnstile in front of it is recommended and not yet wired in.

```bash
npm run create-account                                # mint a number
npm run grant-credit -- "1234 5678 9012 3456" 5000     # add credit directly
npm run delete-account -- "1234 5678 9012 3456"        # show what one account holds (dry run)
npm run delete-account -- "1234 5678 9012 3456" --yes  # delete just that account and its data
npm run db:wipe                                        # show every row count (dry run)
npm run db:wipe -- --yes                               # delete all rows and attachment files
```

## Payments (Dodo Payments)

`/account` → `POST /api/payments` creates a Dodo checkout session and records
a pending `Payment` row (its id is the `ref` passed to Dodo) → the browser is
redirected to Dodo's hosted checkout → on return, `/api/payments/verify`
confirms with Dodo and credits immediately; `/api/payments/webhook`
(`payment.succeeded`, Standard Webhooks signature) is the durable backstop.
Credits are granted exactly once, whichever wins: a conditional update plus
row lock makes it idempotent.

Setup: create a one-time product priced at $1.00 (= 100 credits). Set
`DODO_API_KEY`, `DODO_PRODUCT_ID`, `DODO_WEBHOOK_SECRET`, and `DODO_MODE`
(`test` or `live`). Add a webhook at
`https://<your-domain>/api/payments/webhook` subscribed to
`payment.succeeded` and `payment.failed`. Test and live modes have separate
keys, products and webhook secrets, none of the Dodo values carry over from a
test setup. Payment routes return 503 until `DODO_API_KEY` and
`DODO_PRODUCT_ID` are set; in `live` mode the webhook also needs
`DODO_WEBHOOK_SECRET`. Credits are pegged at 100 per USD; packs must be whole
multiples of `DODO_CREDITS_PER_UNIT` (default 100).

### BTCPay Server (Monero, optional)

A second, non-custodial top-up path: a self-hosted BTCPay Server instance,
not a processor, so no third party ever holds funds or sees the account
number. Point at your own instance (deployed separately, via BTCPay's own
install script, not part of this repo's Docker Compose) with `BTCPAY_URL`,
`BTCPAY_STORE_ID`, `BTCPAY_API_KEY`. Add a webhook at
`https://<your-domain>/api/payments/btcpay/webhook` for the store, event type
`InvoiceSettled` (add `InvoiceExpired` and `InvoiceInvalid` too, so a dropped
invoice is marked failed instead of stuck pending), and set
`BTCPAY_WEBHOOK_SECRET` to the secret it gives you. Leave any of the four
unset to run card-only, the "monero" option on `/account` only appears once
all four are set. The invoice defaults to Monero
(`defaultPaymentMethod: "XMR"`); the BTCPay store needs the Monero payment
method configured, most simply by pointing it at a remote Monero node instead
of running a full node yourself.

## Ad conversion reporting (optional)

Server-to-server only, no script or cookie runs in the browser.
`AdClickCapture` stores an ad's `twclid` from the landing URL in
`localStorage`; on account creation it's sent once to
`src/lib/xConversions.js`, which reports the conversion to X's Conversions
API and discards it. Set `X_PIXEL_ID`, `X_API_KEY`, `X_EVENT_ID` to enable;
leave any unset to report nothing.

## Models, pricing and billing

Chat runs on OpenRouter. Set `OPENROUTER_API_KEY`. `src/lib/pricing.js` holds
the priced `MODELS` table (OpenRouter `provider/model` ids, grouped into
tiers: efficient, flagship, coding, vision, longContext, uncensored) with
each model's token price in USD per 1M and a `default` flag. After editing
that list, `npm run sync-models` prints the same block with live prices to
paste back.

An account with no customization gets each tier's `default: true` models
(`pricing.defaultModelIds`); `/account` lets it enable or disable any model
in the catalogue (`Account.enabledModels`, resolved in
`account.resolveEnabledModels`). This only changes what shows in that
account's model menu, `isAllowedModel`, which the chat route enforces, still
accepts anything in the catalogue.

Users are billed on real usage, see How it works above for the
reservation/settle mechanics. `LLM_MARGIN` (default 1.4) is the multiple
applied to the model's token price; it covers OpenRouter's fee, Dodo's
payment/tax fees on the top-up, refunds on cancelled replies, and hosting.
`100 credits = $1.00` is fixed and carries no markup. `/pricing` renders
straight from the table and states the multiplier.

Image generation uses the same OpenRouter key: `IMAGE_MODEL` (default
`google/gemini-2.5-flash-image`) must be a model that returns an image,
billed a flat `IMAGE_USD` per image with the margin applied. To point chat at
a different OpenAI-compatible `/chat/completions` endpoint instead of
OpenRouter, set `UPSTREAM_BASE_URL` / `UPSTREAM_API_KEY`.

## Security notes

- `.env` is git-ignored. Rotate any key that has been shared.
- Baseline headers and CSP are set in `next.config.mjs`.
- The account number is the only credential. It is masked to the last 4
  digits in logs and never logged in full.
- Message content and reasoning, chat titles, and custom instructions are
  encrypted at rest (AES-256-GCM, key derived from `APP_SECRET`), see
  `src/lib/crypto.js`. A DB leak or backup exposes ciphertext, not
  conversations. After changing `APP_SECRET` in a deploy that already has
  data, old rows stop decrypting, don't rotate it casually. Existing
  plaintext rows from before this was added: `npm run db:encrypt-existing`.

## Roadmap

- Cloudflare Turnstile on signup, to cut bot account creation without adding
  identity.
- Agentic / tool-use support, letting a model run code instead of only
  replying with text.

## Contributing

Fork, branch, and open a PR against `main`. Run `npm test` and `npm run lint`
before pushing, both need to be clean. Keep changes scoped to what the PR
describes, match the existing code style, and use the terms in `CONTEXT.md`
rather than introducing new ones for the same concept. No formal process
beyond that.

## License

AGPL-3.0. Running a modified version as a network service requires making
the source available to its users, see [LICENSE](LICENSE).
