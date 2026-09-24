# syntax=docker/dockerfile:1.4
# ==============================================================================
# 1. Dependencias (Dependencies Stage)
# ==============================================================================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Instalar OpenSSL (Prisma) y Git (clonar dependencias privadas)
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY prisma ./prisma

# Montaje de secreto en memoria: SonarQube validado (docker:S6472)
# El token nunca se almacena en disco ni en metadatos de la imagen
RUN --mount=type=secret,id=github_token \
    git config --global url."https://$(cat /run/secrets/github_token)@github.com/".insteadOf "https://github.com/" && \
    pnpm install && \
    git config --global --unset-all url."https://$(cat /run/secrets/github_token)@github.com/".insteadOf

# Generar el cliente de Prisma para Linux
RUN pnpm prisma generate

# ==============================================================================
# 2. Compilación (Builder Stage)
# ==============================================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Compilar NestJS
RUN pnpm build

# Podar dependencias de desarrollo
RUN pnpm prune --prod

# ==============================================================================
# 3. Entorno de Producción (Runner Stage)
# ==============================================================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Usuario no-root por principio de menor privilegio
RUN groupadd --system --gid 1001 nestgroup && \
    useradd --system --uid 1001 nestuser -g nestgroup

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/archivos/contratos && chown -R nestuser:nestgroup /app/archivos

USER nestuser

EXPOSE 3000

CMD ["node", "dist/main.js"]