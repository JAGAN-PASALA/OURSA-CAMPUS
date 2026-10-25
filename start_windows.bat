@echo off
setlocal
title OUR'S Smart Classroom Setup
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Install Python 3.11 or 3.12 from python.org.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the current Node.js LTS release.
  pause
  exit /b 1
)

if not exist .venv (
  echo Creating Python environment...
  python -m venv .venv
)

.venv\Scripts\python.exe -m pip --version >nul 2>nul
if errorlevel 1 (
  echo Repairing an incomplete Python environment...
  python -m venv --clear .venv
)

set "INSTALL_PYTHON=0"
.venv\Scripts\python.exe -c "import fastapi, alembic, sqlalchemy, cv2, sklearn, pymysql" >nul 2>nul
if errorlevel 1 set "INSTALL_PYTHON=1"
if not exist .venv\.ours-requirements.txt set "INSTALL_PYTHON=1"
if exist .venv\.ours-requirements.txt (
  fc /b backend\requirements.txt .venv\.ours-requirements.txt >nul 2>nul
  if errorlevel 1 set "INSTALL_PYTHON=1"
)
if "%INSTALL_PYTHON%"=="1" (
  echo Installing or updating Python packages...
  call .venv\Scripts\python.exe -m pip install --upgrade pip
  call .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  if errorlevel 1 (
    echo Python package installation failed. Check your internet connection and Python version.
    pause
    exit /b 1
  )
  copy /y backend\requirements.txt .venv\.ours-requirements.txt >nul
)

set "INSTALL_DASHBOARD=0"
if not exist node_modules set "INSTALL_DASHBOARD=1"
if not exist node_modules\.ours-package-lock.json set "INSTALL_DASHBOARD=1"
if exist node_modules\.ours-package-lock.json (
  fc /b package-lock.json node_modules\.ours-package-lock.json >nul 2>nul
  if errorlevel 1 set "INSTALL_DASHBOARD=1"
)
if "%INSTALL_DASHBOARD%"=="1" (
  echo Installing or updating dashboard packages...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Dashboard package installation failed.
    pause
    exit /b 1
  )
  copy /y package-lock.json node_modules\.ours-package-lock.json >nul
)

start "OUR'S Backend" /D "%~dp0backend" cmd /k ..\.venv\Scripts\python.exe run.py
start "OUR'S Dashboard" /D "%~dp0" cmd /k npm run dev -- --host 0.0.0.0 --port 5173

echo Waiting for the backend and dashboard to become ready...
set /a READY_ATTEMPTS=0
:wait_for_application
set /a READY_ATTEMPTS+=1
powershell -NoProfile -Command "try { $h=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8000/api/health; $f=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:5173; if ($h.StatusCode -eq 200 -and $f.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto application_ready
if %READY_ATTEMPTS% GEQ 30 goto application_timeout
timeout /t 2 /nobreak >nul
goto wait_for_application

:application_timeout
echo The application is taking longer than expected. Check the two OUR'S command windows for a red error message.
pause
exit /b 1

:application_ready
start http://localhost:5173
echo OUR'S Smart Classroom is ready. Keep both command windows open while using it.
endlocal
