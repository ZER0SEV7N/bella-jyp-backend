# syntax=docker/dockerfile:1.4
# ==============================================================================
# 1. Dependencias (Dependencies Stage)
# ==============================================================================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Instalar OpenSSL (Prisma) y Git (clonar dependencias privadas si aplica)
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY vendor ./vendor
COPY prisma ./prisma

# Soporta clonación autenticada con secret github_token (si shared-contracts es privado)
RUN --mount=type=secret,id=github_token,required=false \
    if [ -f /run/secrets/github_token ] && [ -s /run/secrets/github_token ]; then \
    git config --global url."https://$(cat /run/secrets/github_token)@github.com/".insteadOf "https://github.com/" && \
    pnpm install --frozen-lockfile && \
    git config --global --unset-all url."https://$(cat /run/secrets/github_token)@github.com/".insteadOf; \
    else \
    pnpm install --frozen-lockfile; \
    fi

# Generar el cliente de Prisma para Linux
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate

# ==============================================================================
# 2. Compilación (Builder Stage)
# ==============================================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Compilar NestJS y podar dependencias de desarrollo con pnpm
RUN pnpm run build && pnpm prune --prod

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
COPY --from=builder /app/src/modules/payroll/planillas/fonts ./dist/modules/payroll/planillas/fonts

RUN mkdir -p /app/archivos/contratos /app/archivos/integraciones && chown -R nestuser:nestgroup /app/archivos

USER nestuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]