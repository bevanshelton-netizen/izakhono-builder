FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 8787
CMD ["npx","wrangler","dev","--config","wrangler.alpha.jsonc","--ip","0.0.0.0","--port","8787"]
