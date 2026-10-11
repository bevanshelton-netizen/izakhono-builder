FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8097

COPY products/izakhono-super-seo/package.json ./package.json
COPY products/izakhono-super-seo/server.mjs ./server.mjs
COPY products/izakhono-super-seo/search-provider.mjs ./search-provider.mjs
COPY products/izakhono-super-seo/growth-engine.mjs ./growth-engine.mjs
COPY products/izakhono-super-seo/growth-loop.mjs ./growth-loop.mjs
COPY products/izakhono-super-seo/operations-engine.mjs ./operations-engine.mjs
COPY products/izakhono-super-seo/ops-engine.mjs ./ops-engine.mjs
COPY products/izakhono-super-seo/public ./public

EXPOSE 8097

HEALTHCHECK --interval=15s --timeout=5s --retries=8 CMD wget -qO- http://127.0.0.1:8097/health || exit 1

USER node
CMD ["node","server.mjs"]
