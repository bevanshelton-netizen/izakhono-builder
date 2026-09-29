FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY campaigns ./campaigns
COPY public ./public
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=8096
ENV GROWTH_DATA_DIR=/data
EXPOSE 8096
CMD ["node","server.mjs"]
