FROM node:22-alpine

WORKDIR /app

COPY deploy-control/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY deploy-control/*.mjs ./

ENV NODE_ENV=production
ENV DEPLOY_API_HOST=0.0.0.0
ENV DEPLOY_API_PORT=8090

USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8090/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
