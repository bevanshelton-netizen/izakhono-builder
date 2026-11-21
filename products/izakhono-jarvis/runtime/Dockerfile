FROM node:22.15.0-bookworm-slim
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /app
COPY products/izakhono-jarvis/runtime/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY products/izakhono-jarvis/runtime/ ./runtime/
COPY products/izakhono-jarvis/src/workforce.ts ./src/workforce.ts
COPY products/izakhono-jarvis/src/api.ts ./src/api.ts
USER node
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--experimental-strip-types","runtime/server.mjs"]
