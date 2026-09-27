FROM node:26-slim AS base
# Prisma needs OpenSSL present to pick its query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# deps + build need devDependencies (tailwind, postcss, prisma CLI); only the
# runtime stage runs as production.
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Lint + the pure-function test suite run as a real build dependency, not a
# separate CI step: `builder` copies its output, so a lint or test failure
# fails `docker compose build` itself, before any running container is
# touched. No DATABASE_URL needed, these tests are self-contained.
FROM deps AS test
COPY . .
RUN npm run lint && npm test

FROM base AS builder
COPY --from=test /app ./
RUN npm run build

# ephemeral image used by docker-compose to run `prisma migrate deploy`
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
