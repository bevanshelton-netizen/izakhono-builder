FROM node:22-alpine
WORKDIR /app
COPY worker.mjs ./
ENV NODE_ENV=production
USER node
CMD ["node","worker.mjs"]
