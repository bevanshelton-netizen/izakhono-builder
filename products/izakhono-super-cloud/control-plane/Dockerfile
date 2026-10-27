FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
RUN addgroup -S izakhono && adduser -S izakhono -G izakhono && mkdir -p /data && chown -R izakhono:izakhono /app /data
USER izakhono
ENV PORT=8180
ENV DATA_DIR=/data
EXPOSE 8180
CMD ["node", "server.mjs"]
