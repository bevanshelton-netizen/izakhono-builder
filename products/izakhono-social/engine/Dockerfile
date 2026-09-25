FROM node:22-alpine AS deps
WORKDIR /app/engine
COPY engine/package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/engine/node_modules ./node_modules
COPY engine/src ./src
COPY engine/scripts ./scripts
COPY db ../db
RUN addgroup -S connecta && adduser -S connecta -G connecta \
    && mkdir -p /var/lib/connecta/media \
    && chown -R connecta:connecta /var/lib/connecta
USER connecta
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:4100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]
