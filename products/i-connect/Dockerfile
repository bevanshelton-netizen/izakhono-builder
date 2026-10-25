FROM node:24-alpine
WORKDIR /app
COPY products/i-connect/package.json ./package.json
RUN npm install --omit=dev
COPY products/i-connect ./
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm","start"]
