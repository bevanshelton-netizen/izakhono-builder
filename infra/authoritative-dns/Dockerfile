FROM powerdns/pdns-auth-49:4.9.17

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 ca-certificates dnsutils \
    && rm -rf /var/lib/apt/lists/*

COPY schema.sqlite3.sql /opt/izakhono-dns/schema.sqlite3.sql
COPY entrypoint.sh /opt/izakhono-dns/entrypoint.sh
RUN chmod 0755 /opt/izakhono-dns/entrypoint.sh \
    && mkdir -p /var/lib/powerdns \
    && chown -R pdns:pdns /var/lib/powerdns /opt/izakhono-dns

ENTRYPOINT ["/opt/izakhono-dns/entrypoint.sh"]
