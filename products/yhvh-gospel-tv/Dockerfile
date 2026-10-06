FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu curl \
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
ENV YHVH_AUTO_RESTART=true
ENV YHVH_STANDBY_SLATE=false
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:8787/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
