#!/bin/sh
set -eu

: "${IZAKHONO_SIP_BIND_ADDRESS:=0.0.0.0:5060}"

mkdir -p /etc/asterisk

sed "s|\${IZAKHONO_SIP_BIND_ADDRESS}|${IZAKHONO_SIP_BIND_ADDRESS}|g" \
  /opt/izakhono/pjsip.conf.template > /etc/asterisk/pjsip.conf
cp /opt/izakhono/extensions.conf.template /etc/asterisk/extensions.conf

# The control plane owns endpoint credentials and routing state. This image only
# boots the pinned SIP engine with the static safety baseline; reconciled tenant
# fragments are added by the runtime adapter before a production service starts.

exec /usr/sbin/asterisk -f -U asterisk -G asterisk -vvv
