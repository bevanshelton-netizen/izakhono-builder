FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
RUN mkdir -p /data
ENV NODE_ENV=production
ENV PORT=9780
ENV VENTURE_FACTORY_HOST=0.0.0.0
ENV VENTURE_FACTORY_DATA_DIR=/data
EXPOSE 9780
CMD ["node","server.mjs"]
