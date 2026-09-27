FROM python:3.12-slim
WORKDIR /app
COPY . /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 IZAKHONO_SHORTS_HOST=0.0.0.0 IZAKHONO_SHORTS_PORT=9710
RUN mkdir -p /app/data/jobs && useradd -r -u 10001 izakhono && chown -R izakhono:izakhono /app
USER izakhono
EXPOSE 9710
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9710/healthz',timeout=3).read()"
CMD ["python","app.py"]
