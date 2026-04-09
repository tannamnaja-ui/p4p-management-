@echo off
echo Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul
echo Starting server...
cd /d "%~dp0"
npm start
