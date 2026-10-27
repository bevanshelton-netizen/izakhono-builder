FROM node:22-alpine

WORKDIR /app

RUN addgroup -S izakhono && adduser -S izakhono -G izakhono

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY server.mjs ./server.mjs
COPY executor.mjs ./executor.mjs
COPY registration.mjs ./registration.mjs
RUN mkdir -p /var/lib/izakhono-node/releases && chown -R izakhono:izakhono /app /var/lib/izakhono-node

USER izakhono
EXPOSE 8787

CMD ["node", "server.mjs"]
