FROM node:22-alpine
WORKDIR /app
COPY runtime/control-plane/package.json ./runtime/control-plane/package.json
COPY runtime/control-plane/server.mjs ./runtime/control-plane/server.mjs
COPY runtime/provisioner/workload-state-machine.mjs ./runtime/provisioner/workload-state-machine.mjs
COPY runtime/provisioner/workload-store.mjs ./runtime/provisioner/workload-store.mjs
COPY runtime/provisioner/workload-worker.mjs ./runtime/provisioner/workload-worker.mjs
COPY runtime/provisioner/runtime-adapter-contract.mjs ./runtime/provisioner/runtime-adapter-contract.mjs
COPY runtime/provisioner/nav-data-pipeline.mjs ./runtime/provisioner/nav-data-pipeline.mjs
COPY runtime/provisioner/nav-data-job-store.mjs ./runtime/provisioner/nav-data-job-store.mjs
COPY runtime/provisioner/nav-data-worker.mjs ./runtime/provisioner/nav-data-worker.mjs
COPY runtime/provisioner/provider-http-client.mjs ./runtime/provisioner/provider-http-client.mjs
COPY runtime/provisioner/http-runtime-adapter.mjs ./runtime/provisioner/http-runtime-adapter.mjs
COPY runtime/provisioner/nav-data-http-adapter.mjs ./runtime/provisioner/nav-data-http-adapter.mjs
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
USER node
CMD ["node","runtime/control-plane/server.mjs"]
