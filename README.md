# velum

velum is ai chat without giving up your identity. no email, no password,
just a random 16-digit account number. credit is bought up front, billed per
token.

Next.js, React, Tailwind, Postgres/Prisma. chat and image generation run
through OpenRouter. domain terms (Account, Credit, Reservation, Exchange...)
are in [CONTEXT.md](CONTEXT.md).

## quickstart

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

```bash
npm test
npm run lint
```

## deploy

```bash
cp .env.example .env   # fill in the values marked "production" in the file
npm run db:migrate     # against the production DATABASE_URL
docker compose up -d --build
```

everything else about env vars, Dodo, BTCPay/Monero, connection pooling, is
documented inline in `.env.example`, that's the source of truth, not this
file. compose runs the app only, non-root, on `127.0.0.1:8293`; put a reverse
proxy in front for TLS.

## admin

```bash
npm run create-account
npm run grant-credit -- "1234 5678 9012 3456" 5000
npm run delete-account -- "1234 5678 9012 3456" --yes
npm run db:wipe -- --yes
```

## security

- `.env` is git-ignored, rotate any key that leaks
- chat content, reasoning, and custom instructions are encrypted at rest
  (`src/lib/crypto.js`), a DB leak exposes ciphertext, not conversations
- the account number is the only credential, masked in logs

## contributing

PRs welcome. `npm test && npm run lint` before you push.

## license

AGPL-3.0, see [LICENSE](LICENSE).
