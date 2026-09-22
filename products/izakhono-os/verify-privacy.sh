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

if grep -R -E -i -n 'google-analytics|segment\.com|mixpanel|amplitude|facebook-pixel|hotjar' "${ROOT}/config" --exclude='verify-privacy.sh'; then
  echo "FAIL: analytics/tracking marker detected"
  fail=1
else
  echo "PASS: no known analytics marker detected in IZAKHONO OS config"
fi

if grep -R -E -i -n 'telemetry.*true|analytics.*true' "${ROOT}/config"; then
  echo "FAIL: telemetry/analytics appears enabled"
  fail=1
else
  echo "PASS: no enabled telemetry/analytics flag detected"
fi

if [[ "${fail}" -ne 0 ]]; then
  echo "PRIVACY GATE: FAILED"
  exit 1
fi

echo "PRIVACY GATE: PASSED"
echo "This verifies IZAKHONO-controlled configuration, not the behaviour of third-party websites, ISPs, independently installed apps or hardware firmware."
