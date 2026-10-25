@echo off
setlocal
title OUR'S Platform Administrator
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
  echo Run configure_mysql_windows.bat or start_windows.bat first.
  pause
  exit /b 1
)

.venv\Scripts\python.exe -c "import alembic, sqlalchemy, pymysql" >nul 2>nul
if errorlevel 1 (
  echo Installing required backend packages. Please allow it to finish...
  .venv\Scripts\python.exe -m ensurepip --upgrade
  .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  if errorlevel 1 (
    echo Package installation failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)

.venv\Scripts\python.exe scripts\create_platform_admin.py
pause
endlocal
