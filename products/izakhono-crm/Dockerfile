FROM node:22-alpine
WORKDIR /app
COPY package.json server.js server-v2.mjs start-v2.mjs staff.example.json ./
COPY public ./public
COPY portfolio-crm-registry.json ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV HOST=0.0.0.0
ENV PORT=8080
ENV CRM_DATA_FILE=/data/crm.json
ENV CRM_ALLOW_INSECURE_LOCAL=false
EXPOSE 8080
CMD ["node","start-v2.mjs"]
