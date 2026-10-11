@echo off
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" scripts\export_static.py
) else (
  py -3.10 scripts\export_static.py
)

if errorlevel 1 (
  echo.
  echo Static export failed. Check that Flask and its Jinja2 dependency are installed.
) else (
  echo.
  echo Static site is ready in the site folder.
)
pause
