FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs test.mjs ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV PORT=8788
ENV ALLEGRO_DATA_DIR=/app/data
EXPOSE 8788
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
