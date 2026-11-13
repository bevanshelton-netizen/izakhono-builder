FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-package-lock
COPY server.mjs ./
COPY provisioner ./provisioner
RUN mkdir -p /data
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
USER node
CMD ["node","server.mjs"]
