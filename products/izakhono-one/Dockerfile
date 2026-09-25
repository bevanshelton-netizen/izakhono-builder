FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
ENV NODE_ENV=production
ENV PORT=8781
EXPOSE 8781
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8781/health >/dev/null || exit 1
CMD ["node","server.mjs"]
