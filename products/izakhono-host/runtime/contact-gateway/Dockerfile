FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY routes.json ./
ENV NODE_ENV=production PORT=8090
EXPOSE 8090
USER node
CMD ["node","server.mjs"]
