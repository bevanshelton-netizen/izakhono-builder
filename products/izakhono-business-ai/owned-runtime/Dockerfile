FROM node:22-alpine
WORKDIR /app
COPY server.mjs index.html ./
ENV NODE_ENV=production
ENV PORT=8787
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O - http://127.0.0.1:8787/health | grep -q '"ok":true' || exit 1
CMD ["node","server.mjs"]
