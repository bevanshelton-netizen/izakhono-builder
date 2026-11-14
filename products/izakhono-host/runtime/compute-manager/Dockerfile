FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production PORT=8082 DATA_DIR=/data
EXPOSE 8082
USER node
CMD ["node","server.mjs"]
