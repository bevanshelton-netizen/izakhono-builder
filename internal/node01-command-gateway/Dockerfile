FROM node:22-alpine
WORKDIR /app
COPY public ./public
COPY internal/node01-command-gateway ./internal/node01-command-gateway
ENV IZAKHONO_BIND_HOST=0.0.0.0
ENV IZAKHONO_COMMAND_PORT=8091
EXPOSE 8091
CMD ["node","internal/node01-command-gateway/server.mjs"]
