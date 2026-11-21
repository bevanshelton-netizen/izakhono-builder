FROM node:22-alpine
WORKDIR /app
COPY runtime/control-plane/package.json ./runtime/control-plane/package.json
COPY runtime/control-plane/server.mjs ./runtime/control-plane/server.mjs
COPY runtime/provisioner/workload-state-machine.mjs ./runtime/provisioner/workload-state-machine.mjs
COPY runtime/provisioner/workload-store.mjs ./runtime/provisioner/workload-store.mjs
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
USER node
CMD ["node","runtime/control-plane/server.mjs"]
