# El ejecutor utiliza los mismos generadores y dependencias probados en el backend.

# Se ejecuta dentro de n8n: no traslada el renderizado pesado al proceso HTTP de NestJS.

FROM node:22-alpine AS tareas

WORKDIR /opt/jyp

RUN apk add --no-cache openssl git

COPY package.json package-lock.json ./

COPY vendor ./vendor

# Alinea @jyp/shared-contracts con el paquete empaquetado en ./vendor y ejecuta `npm install`

# (en lugar de `npm ci`) para tolerar diferencias entre `pnpm-lock.yaml` y `package-lock.json`.

RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));if(fs.existsSync('vendor/jyp-shared-contracts-1.2.0.tgz')){p.dependencies['@jyp/shared-contracts']='file:vendor/jyp-shared-contracts-1.2.0.tgz';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');}"

RUN npm install --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./

COPY prisma ./prisma

COPY src ./src

RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

RUN npm run build && npm prune --omit=dev



FROM docker.n8n.io/n8nio/n8n:2.44.6

USER root

COPY --from=tareas /opt/jyp/node_modules /opt/jyp/node_modules

COPY --from=tareas /opt/jyp/dist /opt/jyp/dist

COPY --from=tareas /opt/jyp/src/modules/payroll/planillas/fonts /opt/jyp/dist/modules/payroll/planillas/fonts

COPY n8n/tareas /opt/jyp/n8n/tareas

RUN mkdir -p /files && chown -R node:node /files /opt/jyp

USER node

