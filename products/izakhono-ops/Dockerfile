FROM python:3.12-alpine
WORKDIR /app
COPY ops.py .
ENV IZAKHONO_OPS_PORT=9393
EXPOSE 9393
USER nobody
CMD ["python","ops.py"]
