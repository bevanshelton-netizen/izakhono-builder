FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs test.mjs ./
RUN node --check server.mjs
EXPOSE 8787
CMD ["node", "server.mjs"]
