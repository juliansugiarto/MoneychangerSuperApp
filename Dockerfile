# syntax=docker/dockerfile:1
# Image aplikasi untuk tumpukan Docker di VPS (deploy/vps/compose.yaml). Satu image untuk web (`node dist/index.js`) dan
# skrip operator (`node scripts/migrate.mjs`, `node scripts/tenant.mjs setup-code`). Versi Node sama dengan tokoemas di VPS
# yang sama, supaya lapisan dasarnya dipakai bersama.
ARG NODE_IMAGE=node:22.22.0-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NODE_ENV=production wajib: tanpa itu Vite membangun bundel pengembangan (jsxDEV).
RUN NODE_ENV=production pnpm run build

FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# Berkas milik root (hanya dibaca); proses berjalan sebagai `node` (uid 1000) dan tidak menulis ke disk.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
COPY scripts/migrate.mjs scripts/tenant.mjs scripts/setupCode.mjs ./scripts/
USER node
EXPOSE 3000
# tRPC system.health (superjson): input {"json":{"timestamp":0}}.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/index.js"]
