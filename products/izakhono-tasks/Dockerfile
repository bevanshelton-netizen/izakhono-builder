FROM python:3.13-slim
WORKDIR /app
COPY app.py /app/app.py
ENV IZAKHONO_TASKS_HOST=0.0.0.0
ENV IZAKHONO_TASKS_PORT=9991
ENV IZAKHONO_TASKS_DB=/data/izakhono-tasks.db
VOLUME ["/data"]
EXPOSE 9991
CMD ["python","/app/app.py"]
