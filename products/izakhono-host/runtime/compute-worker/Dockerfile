FROM node:22-alpine
WORKDIR /app
COPY worker.mjs ./
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production WORKER_DATA_DIR=/data
VOLUME ["/data"]
USER node
CMD ["node","worker.mjs"]
