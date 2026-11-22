#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0

echo "IZAKHONO OS Privacy Gate"

required=(
  'DisableTelemetry'
  'DisableFirefoxStudies'
  'toolkit.telemetry.enabled", false'
  'datareporting.healthreport.uploadEnabled", false'
)

for needle in "${required[@]}"; do
  if grep -R -F -q "${needle}" "${ROOT}/config"; then
    echo "PASS: ${needle}"
  else
    echo "FAIL: missing ${needle}"
    fail=1
  fi
done

for source in "${ROOT}/config" "${ROOT}/engine"; do
  if grep -R -E -i -n 'google-analytics|segment\.com|mixpanel|amplitude|facebook-pixel|hotjar' "${source}" --exclude='verify-privacy.sh'; then
    echo "FAIL: analytics/tracking marker detected in ${source}"
    fail=1
  else
    echo "PASS: no known analytics marker detected in ${source}"
  fi
done

# Match explicit enablement keys only. Do not treat safety controls such as
# "DisableTelemetry": true as telemetry being enabled.
if grep -R -E -i -n 'toolkit\.telemetry\.enabled[^[:alnum:]]*(=|:|",)[[:space:]]*true|datareporting\.healthreport\.uploadEnabled[^[:alnum:]]*(=|:|",)[[:space:]]*true|analytics[._-]?enabled[^[:alnum:]]*(=|:|",)[[:space:]]*true' "${ROOT}/config" "${ROOT}/engine"; then
  echo "FAIL: an explicit telemetry/analytics enable flag was detected"
  fail=1
else
  echo "PASS: no explicit telemetry/analytics enable flag detected"
fi

if [[ "${fail}" -ne 0 ]]; then
  echo "PRIVACY GATE: FAILED"
  exit 1
fi

echo "PRIVACY GATE: PASSED"
echo "This verifies IZAKHONO-controlled configuration, not the behaviour of third-party websites, ISPs, independently installed apps or hardware firmware."
