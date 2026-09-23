FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY scripts ./scripts
RUN addgroup -S connecta && adduser -S connecta -G connecta \
    && mkdir -p /var/lib/connecta/media \
    && chown -R connecta:connecta /var/lib/connecta
USER connecta
EXPOSE 4100
CMD ["node", "src/server.js"]
