FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs wave1-adapters.json ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV HOST=0.0.0.0
ENV PORT=8090
ENV FABRIC_OUTBOX_FILE=/data/outbox.json
EXPOSE 8090
CMD ["node","server.mjs"]
