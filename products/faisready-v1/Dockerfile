FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY index.html styles.css app.js merch.json ./
COPY owner ./owner
COPY assets ./assets
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node","server.js"]
