# syntax=docker/dockerfile:1
#
# Imagem do dashboard. O contexto de build e a RAIZ do repositorio:
#
#   docker build -f apps/web/Dockerfile -t squadbot-web .
#
# No Railway: Root Directory = "/" e Dockerfile Path = "apps/web/Dockerfile".

# ---------- build ----------
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @squadbot/web --include-workspace-root

COPY apps/web apps/web

# Segredo de build descartavel: todas as rotas sao dinamicas, entao nada
# sensivel e embutido no bundle. Os valores reais chegam em runtime.
ENV AUTH_SECRET=build-time-placeholder
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @squadbot/web

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# `output: standalone` ja resolve as dependencias necessarias: a imagem final
# nao precisa de npm install.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
