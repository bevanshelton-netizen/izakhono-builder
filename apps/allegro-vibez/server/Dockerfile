FROM node:22-alpine
WORKDIR /app
COPY server/package.json ./package.json
COPY server/index.js ./index.js
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.js"]
