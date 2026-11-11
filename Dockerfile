FROM nginx:1.27-alpine
COPY public/ai-core/nav/ /usr/share/nginx/html/
RUN test -s /usr/share/nginx/html/index.html && test -s /usr/share/nginx/html/health.json
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/health.json || exit 1
