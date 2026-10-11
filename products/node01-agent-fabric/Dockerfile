FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/src
WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
COPY tests ./tests

RUN python -m unittest discover -s tests -v

ENTRYPOINT ["python", "-m", "node01"]
CMD ["--health"]
