FROM python:3.12-alpine
WORKDIR /app
COPY index.html styles.css app.js curriculum.json platform.json institutions.json locales.json healthz engine.py verify.py ./
RUN python verify.py
EXPOSE 8080
ENV IZAKHONO_DF_HOST=0.0.0.0
ENV IZAKHONO_DF_PORT=8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
CMD ["python", "engine.py"]
