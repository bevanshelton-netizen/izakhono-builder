#requires -Version 5.1
$ErrorActionPreference = "Stop"
$Base = "http://127.0.0.1:9393"

$health = Invoke-RestMethod -Uri "$Base/healthz" -TimeoutSec 5
if (-not $health.ok -or $health.version -ne "0.2.2") {
  throw "IZAKHONO WORK 0.2.2 is not ready."
}

$body = @{
  project_name = "OWNER-NODE-PROOF"
  spec = 'Create one complete static webpage in index.html. Display "IZAKHONO OWNER NODE ACTIVE" prominently, "6 September 2026", and "Built locally on the owner laptop". Use attractive inline CSS, no external libraries or assets. Save the file locally, validate it, and finish only when the project contains the working index.html file.'
} | ConvertTo-Json

$job = Invoke-RestMethod -Uri "$Base/api/build" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
Write-Host "OWNER-NODE-PROOF started: $($job.job_id)"

for ($i=0; $i -lt 900; $i++) {
  Start-Sleep -Seconds 2
  $state = Invoke-RestMethod -Uri "$Base/api/builds/$($job.job_id)" -TimeoutSec 10
  if ($state.status -eq "complete") {
    $result = $state.result
    if (-not $result.validation_ok) { throw "Build completed but validation failed." }
    $fileCount = @($result.files | Where-Object { $_.type -eq "file" }).Count
    if ($fileCount -lt 1) { throw "Build completed without files." }
    Write-Host ""
    Write-Host "IZAKHONO_OWNER_NODE_BUILD_PROOF=PASS"
    Write-Host "Project: $($result.project)"
    Write-Host "Files: $fileCount"
    Write-Host "Validation: PASS"
    if ($result.preview_url) {
      Start-Process "$Base$($result.preview_url)"
    }
    exit 0
  }
  if ($state.status -eq "failed") {
    throw "Build failed: $($state.error)"
  }
  if (($i % 15) -eq 0) { Write-Host "Building locally... $($state.status)" }
}
throw "OWNER-NODE-PROOF did not finish within 30 minutes."
