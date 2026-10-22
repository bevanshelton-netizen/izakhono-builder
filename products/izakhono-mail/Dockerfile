FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
RUN mkdir -p /app/data
ENV NODE_ENV=production
CMD ["node", "src/server.mjs"]
