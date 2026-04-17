@echo off
chcp 65001 >nul
title ติดตั้งระบบ P4P Management

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║       ระบบบริหาร P4P - โรงพยาบาลพุทธชินราช      ║
echo  ║              กำลังติดตั้งระบบ...                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ตรวจสอบ Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] ไม่พบ Node.js กรุณาติดตั้งก่อน
    echo      ดาวน์โหลดได้ที่: https://nodejs.org
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

:: แสดง version
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [✓] Node.js %NODE_VER% พร้อมใช้งาน

:: ตรวจสอบ Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] ไม่พบ Git กรุณาติดตั้งก่อน
    echo      ดาวน์โหลดได้ที่: https://git-scm.com
    echo.
    pause
    start https://git-scm.com
    exit /b 1
)
echo  [✓] Git พร้อมใช้งาน

:: กำหนดโฟลเดอร์ติดตั้ง
set INSTALL_DIR=%USERPROFILE%\P4P-System

echo.
echo  [i] จะติดตั้งที่: %INSTALL_DIR%
echo.

:: ลบโฟลเดอร์เดิมถ้ามี
if exist "%INSTALL_DIR%" (
    echo  [i] พบการติดตั้งเดิม กำลังอัปเดต...
    cd /d "%INSTALL_DIR%"
    git pull origin main
    goto :install_deps
)

:: Clone จาก GitHub
echo  [i] กำลัง Clone จาก GitHub...
git clone https://github.com/tannamnaja-ui/p4p-management-.git "%INSTALL_DIR%"
if %errorlevel% neq 0 (
    echo  [!] Clone ไม่สำเร็จ กรุณาตรวจสอบ internet
    pause
    exit /b 1
)
echo  [✓] Clone สำเร็จ

:install_deps
:: ติดตั้ง dependencies
echo.
echo  [i] กำลังติดตั้ง dependencies...
cd /d "%INSTALL_DIR%"
call npm install --silent
if %errorlevel% neq 0 (
    echo  [!] npm install ไม่สำเร็จ
    pause
    exit /b 1
)
echo  [✓] ติดตั้ง dependencies สำเร็จ

:: สร้างไฟล์ config เริ่มต้น
if not exist "%INSTALL_DIR%\config\settings.json" (
    echo  [i] สร้างไฟล์ config เริ่มต้น...
    echo {"db_type":"postgresql","db_host":"localhost","db_port":"5432","db_user":"","db_password":"","db_name":""} > "%INSTALL_DIR%\config\settings.json"
    echo  [✓] สร้างไฟล์ config สำเร็จ
)

:: สร้าง shortcut บน Desktop
echo  [i] สร้าง shortcut บน Desktop...
set SHORTCUT=%USERPROFILE%\Desktop\P4P System.lnk
set SCRIPT_PATH=%INSTALL_DIR%\start.bat
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%SCRIPT_PATH%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = 'shell32.dll,13'; $s.Description = 'ระบบบริหาร P4P โรงพยาบาลพุทธชินราช'; $s.Save()"
echo  [✓] สร้าง shortcut บน Desktop สำเร็จ

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║           ติดตั้งสำเร็จเรียบร้อย!               ║
echo  ║                                                  ║
echo  ║  วิธีเปิดใช้งาน:                                ║
echo  ║  1. ดับเบิ้ลคลิก "P4P System" บน Desktop        ║
echo  ║  2. หรือรัน start.bat ในโฟลเดอร์ติดตั้ง         ║
echo  ║                                                  ║
echo  ║  URL: http://localhost:3009                      ║
echo  ╚══════════════════════════════════════════════════╝
echo.

set /p OPEN_NOW=  กดเปิดใช้งานเลยไหม? (Y/N):
if /i "%OPEN_NOW%"=="Y" (
    start "" "%INSTALL_DIR%\start.bat"
)

pause
