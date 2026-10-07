FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /data
ENV NODE01_DATA_DIR=/data
ENV PORT=8940
EXPOSE 8940
USER node
CMD ["npm","start"]
