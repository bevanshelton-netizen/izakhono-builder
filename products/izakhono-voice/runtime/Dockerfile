FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY products/izakhono-voice/runtime/package.json ./package.json
COPY products/izakhono-voice/runtime/tsconfig.json ./tsconfig.json
RUN npm install --no-audit --no-fund

COPY products/izakhono-voice/runtime/src ./runtime/src
COPY products/izakhono-voice/src ./src
RUN npm run build
RUN npm prune --omit=dev --no-audit

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 8962
CMD ["node", "dist/runtime/src/server.js"]
