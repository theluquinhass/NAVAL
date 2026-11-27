# syntax=docker/dockerfile:1
# API do NAVAL (Express 5 / Node 22).
#   target "dev":  nodemon com o código montado por volume (compose.yaml)
#   target "prod": somente dependências de produção, usuário sem privilégios (compose.prod.yaml)

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./

FROM base AS dev
ENV NODE_ENV=development
RUN npm ci
COPY --chown=node:node src ./src
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server.js"]
