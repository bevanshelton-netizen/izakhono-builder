$ErrorActionPreference = "Stop"
$url = "http://127.0.0.1:9393/healthz"
try {
  $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url
  if ($r.StatusCode -ne 200) { throw "OPS health returned $($r.StatusCode)" }
  Write-Host "IZAKHONO OPS: HEALTHY"
} catch {
  Write-Error "IZAKHONO OPS: NOT READY - $($_.Exception.Message)"
  exit 1
}
