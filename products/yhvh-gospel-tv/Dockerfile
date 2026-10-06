FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY server.mjs ./
COPY public ./public
COPY playout ./playout

RUN mkdir -p /app/content-vault /app/data/hls
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV YHVH_CONTENT_VAULT=/app/content-vault
ENV YHVH_HLS_DIR=/app/data/hls
EXPOSE 8787

CMD ["node", "server.mjs"]
