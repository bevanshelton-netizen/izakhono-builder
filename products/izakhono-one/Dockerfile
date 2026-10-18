FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs node-gateway.mjs ./
COPY services ./services
COPY public ./public
ENV NODE_ENV=production
ENV PORT=8781
ENV PUBLIC_PORT=8781
ENV INTERNAL_HOST=127.0.0.1
ENV HOST=0.0.0.0
EXPOSE 8781
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8781/health >/dev/null || exit 1
CMD ["node","node-gateway.mjs"]
