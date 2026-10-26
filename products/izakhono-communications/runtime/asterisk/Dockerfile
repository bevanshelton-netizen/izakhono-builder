FROM debian:bookworm-slim

ARG ASTERISK_VERSION=22.11.0

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl wget pkg-config \
      libedit-dev libjansson-dev libsqlite3-dev libssl-dev \
      libxml2-dev libncurses5-dev uuid-dev libspeexdsp-dev \
      libogg-dev libvorbis-dev libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
RUN curl -fsSLO https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz \
    && tar -xzf asterisk-${ASTERISK_VERSION}.tar.gz \
    && rm asterisk-${ASTERISK_VERSION}.tar.gz

WORKDIR /usr/src/asterisk-${ASTERISK_VERSION}
RUN ./contrib/scripts/install_prereq install \
    && ./configure --with-pjproject-bundled \
    && make -j"$(nproc)" \
    && make install \
    && make samples \
    && make config \
    && ldconfig

RUN groupadd --system asterisk \
    && useradd --system --gid asterisk --home /var/lib/asterisk --no-create-home asterisk \
    && mkdir -p /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk \
    && chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /var/run/asterisk

COPY pjsip.conf.template /opt/izakhono/pjsip.conf.template
COPY extensions.conf.template /opt/izakhono/extensions.conf.template
COPY entrypoint.sh /opt/izakhono/entrypoint.sh
RUN chmod 0755 /opt/izakhono/entrypoint.sh

EXPOSE 5060/udp 5061/tcp
EXPOSE 10000-10100/udp

USER asterisk
ENTRYPOINT ["/opt/izakhono/entrypoint.sh"]
