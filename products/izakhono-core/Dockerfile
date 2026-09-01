FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY sql ./sql
COPY src ./src
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
