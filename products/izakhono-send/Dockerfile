FROM python:3.13-slim
WORKDIR /app
COPY app.py /app/app.py
ENV IZAKHONO_SEND_HOST=0.0.0.0
ENV IZAKHONO_SEND_PORT=8787
ENV IZAKHONO_SEND_ROOT=/data
EXPOSE 8787
VOLUME ["/data"]
CMD ["python","/app/app.py"]
