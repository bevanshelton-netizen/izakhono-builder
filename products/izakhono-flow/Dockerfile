FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV HOST=0.0.0.0 PORT=8794 FLOW_DATA_FILE=/data/flow-data.json FLOW_ALLOW_INSECURE_LOCAL=false
EXPOSE 8794
CMD ["node","server.mjs"]
