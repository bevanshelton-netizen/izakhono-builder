FROM node:24-alpine
WORKDIR /app
COPY products/i-connect/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY products/i-connect ./
USER node
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm","start"]
