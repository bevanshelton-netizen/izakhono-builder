FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir "cryptography>=43,<47"
COPY app.py worker.py /app/
RUN useradd -r -u 10001 izakhono && mkdir -p /data/artifacts && chown -R izakhono:izakhono /data /app
USER izakhono
ENV IZAKHONO_MEDIA_FABRIC_HOST=0.0.0.0 \
    IZAKHONO_MEDIA_FABRIC_PORT=9751 \
    IZAKHONO_MEDIA_FABRIC_DB=/data/fabric.db \
    IZAKHONO_MEDIA_FABRIC_ARTIFACT_ROOT=/data/artifacts
EXPOSE 9751
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9751/healthz',timeout=3).read()"
CMD ["python","/app/app.py"]
