@echo off
chcp 65001 >nul
title P4P Create Tables

echo.
echo ============================================
echo   P4P - สร้างตาราง p4p_doctor_point
echo              tmp_p4p_point
echo              p4p_point_log
echo ============================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ไม่พบ Node.js กรุณาติดตั้ง Node.js ก่อน
    pause
    exit /b 1
)

node create-tables.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] เกิดข้อผิดพลาดในการสร้างตาราง
    pause
    exit /b 1
)

echo.
pause
