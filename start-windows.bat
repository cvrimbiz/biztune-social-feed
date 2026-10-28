@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte Node.js ab Version 20 von https://nodejs.org installieren.
  pause
  exit /b 1
)
node server.mjs --open
pause
