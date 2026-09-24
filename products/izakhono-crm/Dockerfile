FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
COPY portfolio-crm-registry.json ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV HOST=0.0.0.0
ENV PORT=8080
ENV CRM_DATA_FILE=/data/crm.json
EXPOSE 8080
CMD ["node","server.js"]
