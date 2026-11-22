FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends docker.io git tar ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY runner/server.mjs ./server.mjs
USER root
EXPOSE 8860
CMD ["node","server.mjs"]
