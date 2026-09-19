@echo off
chcp 65001 >nul
cd /d "%~dp0"
title KokoAI - helyi teszt

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nincs telepitve, telepitem...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  echo.
  echo Kesz. Zard be ezt az ablakot es inditsd ujra az inditas.bat-ot.
  pause
  exit /b
)

if not exist ".env.local" (
  set /p KEY=Gemini API kulcs: 
  call echo GEMINI_API_KEY=%%KEY%%> .env.local
)

node dev-server.mjs
pause
