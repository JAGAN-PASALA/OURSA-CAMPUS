@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Run start_windows.bat once first.
  pause
  exit /b 1
)
echo Starting timetable-aware CCTV camera worker...
".venv\Scripts\python.exe" backend\camera_worker.py
if errorlevel 1 pause
