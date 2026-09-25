FROM python:3.12-alpine
WORKDIR /app
COPY index.html styles.css app.js curriculum.json platform.json institutions.json locales.json institutional-offers.json automation.json assessment-blueprint.json adapter-contracts.json healthz engine.py automation_engine.py automation_store.py learner_access.py assessment_service.py credential_service.py verify.py test_automation.py test_automation_store.py test_zero_touch.py ./
RUN mkdir -p /data && python verify.py && python test_automation.py && python test_automation_store.py && python test_zero_touch.py
EXPOSE 8080
ENV IZAKHONO_DF_HOST=0.0.0.0
ENV IZAKHONO_DF_PORT=8080
ENV IZAKHONO_DF_STATE_DB=/data/izakhono-df.sqlite3
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1:8080/healthz || exit 1
CMD ["python", "engine.py"]
