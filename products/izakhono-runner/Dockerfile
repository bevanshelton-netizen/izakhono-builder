FROM python:3.13-slim
WORKDIR /app
COPY app.py /app/app.py
ENV IZAKHONO_RUNNER_HOST=0.0.0.0
ENV IZAKHONO_RUNNER_PORT=9992
ENV IZAKHONO_RUNNER_DB=/data/izakhono-runner.db
VOLUME ["/data"]
EXPOSE 9992
CMD ["python","/app/app.py"]
