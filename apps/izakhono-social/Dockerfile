FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY network.js /usr/share/nginx/html/network.js
COPY healthz /usr/share/nginx/html/healthz
COPY release.json /usr/share/nginx/html/release.json
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1/healthz || exit 1
