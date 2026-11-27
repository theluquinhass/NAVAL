# syntax=docker/dockerfile:1
# App web do NAVAL (React 19 / Vite 8).
#   target "dev":  servidor do Vite com HMR e o código montado por volume (compose.yaml)
#   target "prod": build estático servido pelo nginx, que também faz o proxy de /api (compose.prod.yaml)

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM deps AS build
COPY --chown=node:node . .
# As variáveis VITE_* são embutidas no bundle durante o build (lidas de frontend/.env).
# Elas são públicas por definição: nunca coloque segredos em VITE_*.
# VITE_API_URL é fixado em /api porque o nginx faz o proxy para a API.
ENV VITE_API_URL=/api
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
