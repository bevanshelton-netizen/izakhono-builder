FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
RUN chown -R node:node /app
USER node
EXPOSE 8091
CMD ["node", "server.mjs"]
