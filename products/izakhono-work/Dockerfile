FROM python:3.13-slim
WORKDIR /app
COPY app.py builder_core.py /app/
RUN mkdir -p /data && useradd --system --uid 10001 izakhono && chown -R izakhono:izakhono /app /data
USER izakhono
ENV IZAKHONO_WORK_HOST=0.0.0.0 \
    IZAKHONO_WORK_PORT=9393 \
    IZAKHONO_WORK_DATA=/data \
    IZAKHONO_OLLAMA_URL=http://izakhono-ollama:11434
EXPOSE 9393
VOLUME ["/data"]
CMD ["python3","/app/app.py"]
