FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
ENV PORT=8788
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8788/health >/dev/null || exit 1
USER node
CMD ["node","src/server.js"]
