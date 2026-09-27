FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV HOST=0.0.0.0 PORT=8795 REVENUE_DATA_FILE=/data/revenue.json REVENUE_ALLOW_INSECURE_LOCAL=false
VOLUME ["/data"]
EXPOSE 8795
CMD ["node","server.mjs"]
