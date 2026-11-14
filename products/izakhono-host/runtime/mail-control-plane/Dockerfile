FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --system --uid 10001 --create-home mailcontrol && mkdir -p /var/lib/izakhono-mail && chown -R mailcontrol:mailcontrol /app /var/lib/izakhono-mail
COPY api ./api
COPY verify_tls.py ./verify_tls.py
USER mailcontrol
EXPOSE 8000
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
