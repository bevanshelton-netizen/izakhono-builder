FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
ENV NODE01_HOST=0.0.0.0
ENV NODE01_PORT=8940
ENV NODE01_ROOT=/data/node01
EXPOSE 8940
VOLUME ["/data/node01"]
CMD ["node", "server.js"]
