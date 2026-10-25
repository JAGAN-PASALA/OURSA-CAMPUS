@echo off
setlocal
title OUR'S MySQL Setup
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Install Python 3.11 or 3.12 from python.org.
  pause
  exit /b 1
)

if not exist .venv (
  echo Creating Python environment. Please allow it to finish...
  python -m venv .venv
)

echo Installing the application packages...
.venv\Scripts\python.exe -m ensurepip --upgrade
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (
  echo Package installation failed. Check the internet connection and try again.
  pause
  exit /b 1
)

.venv\Scripts\python.exe scripts\configure_mysql.py
pause
endlocal
