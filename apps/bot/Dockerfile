# syntax=docker/dockerfile:1
#
# Imagem do bot. O contexto de build e a RAIZ do repositorio (monorepo npm
# workspaces), nao esta pasta:
#
#   docker build -f apps/bot/Dockerfile -t squadbot-bot .
#
# No Railway: Root Directory = "/" e Dockerfile Path = "apps/bot/Dockerfile".

# ---------- build ----------
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Camada de dependencias: so invalida quando os manifests mudam.
COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/package.json
RUN npm ci --workspace @squadbot/bot --include-workspace-root

COPY apps/bot/tsconfig.json apps/bot/tsconfig.json
COPY apps/bot/src apps/bot/src
RUN npm run build --workspace @squadbot/bot

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/squadbot.db

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/package.json
RUN npm ci --omit=dev --workspace @squadbot/bot --include-workspace-root \
    && npm cache clean --force

COPY --from=builder /app/apps/bot/dist apps/bot/dist

# O filesystem do container e efemero: /app/data precisa receber um volume
# persistente em runtime (Railway Volumes, ou -v / docker compose localmente).
# Nao declaramos VOLUME aqui — o Railway rejeita a instrucao e ela nao e
# necessaria para que o mount funcione.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

CMD ["node", "apps/bot/dist/index.js"]
