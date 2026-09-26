FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json config.js lib.js server.js ./
USER node
EXPOSE 8788
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
