@echo off
setlocal

set "PORT=4173"
echo Stopping the Automatic Control AI Question Bank on port %PORT%...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$connections = @(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue); if (-not $connections) { Write-Host 'No service is listening on this port.'; exit 0 }; $connections | ForEach-Object { $processId = $_.OwningProcess; try { Stop-Process -Id $processId -Force -ErrorAction Stop; Write-Host ('Stopped process ' + $processId) } catch { Write-Host ('Could not stop process ' + $processId + ': ' + $_.Exception.Message); exit 1 } }"

if errorlevel 1 (
  echo Failed to stop the service.
  pause
  exit /b 1
)

echo The local service has stopped.
pause
