FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY products/izakhono-isbn/runtime/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY products/izakhono-isbn/src ./src
COPY products/izakhono-isbn/public ./public
USER node
EXPOSE 8080
CMD ["npm", "start"]
