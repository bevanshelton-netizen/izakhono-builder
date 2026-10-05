FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
COPY playout ./playout

RUN mkdir -p /app/content-vault /app/data
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV YHVH_CONTENT_VAULT=/app/content-vault
EXPOSE 8787

CMD ["node", "server.mjs"]
