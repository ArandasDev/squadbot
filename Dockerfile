# syntax=docker/dockerfile:1

# ---------- build ----------
# Compila o TypeScript de src/ para JavaScript em dist/.
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Camada de dependencias: so invalida quando o lockfile muda.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime ----------
# Imagem final: apenas dependencias de producao + JavaScript compilado.
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/squadbot.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# O filesystem do container é efemero: /app/data precisa receber um volume
# persistente em runtime (Railway Volumes, ou -v / docker compose localmente).
# Nao declaramos VOLUME aqui — o Railway rejeita a instrucao e ela nao e
# necessaria para que o mount funcione.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

CMD ["node", "dist/index.js"]
