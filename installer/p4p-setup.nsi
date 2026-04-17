; P4P Management System - NSIS Installer Script
; โรงพยาบาลพุทธชินราช

Unicode True

!include "MUI2.nsh"
!include "LogicLib.nsh"

;--------------------------------
; General
Name "ระบบ P4P Management - โรงพยาบาลพุทธชินราช"
OutFile "P4P-Setup.exe"
InstallDir "$LOCALAPPDATA\P4P-System"
InstallDirRegKey HKCU "Software\P4P-Management" "Install_Dir"
RequestExecutionLevel user
BrandingText "P4P Management System v1.0"

;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "ยินดีต้อนรับสู่ระบบ P4P Management"
!define MUI_WELCOMEPAGE_TEXT "โปรแกรมนี้จะติดตั้งระบบบริหาร P4P สำหรับโรงพยาบาลพุทธชินราช$\r$\n$\r$\nกดถัดไปเพื่อดำเนินการต่อ"
!define MUI_FINISHPAGE_RUN "$INSTDIR\start.bat"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดระบบ P4P เดี๋ยวนี้"
!define MUI_FINISHPAGE_LINK "http://localhost:3009"
!define MUI_FINISHPAGE_LINK_LOCATION "http://localhost:3009"

;--------------------------------
; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
; Language
!insertmacro MUI_LANGUAGE "Thai"

;--------------------------------
; Installer Section
Section "P4P Management System" SecMain

  SetOutPath "$INSTDIR"

  ; สร้างโฟลเดอร์
  CreateDirectory "$INSTDIR"
  CreateDirectory "$INSTDIR\config"

  ; เขียน start.bat
  FileOpen $0 "$INSTDIR\start.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title ระบบ P4P Management$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "echo กำลังเริ่มต้นระบบ P4P...$\r$\n"
  FileWrite $0 "start http://localhost:3009$\r$\n"
  FileWrite $0 "node server.js$\r$\n"
  FileClose $0

  ; เขียน update.bat
  FileOpen $0 "$INSTDIR\update.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title อัปเดตระบบ P4P$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "echo กำลังอัปเดตจาก GitHub...$\r$\n"
  FileWrite $0 "git pull origin main$\r$\n"
  FileWrite $0 "npm install$\r$\n"
  FileWrite $0 "echo อัปเดตสำเร็จ!$\r$\n"
  FileWrite $0 "pause$\r$\n"
  FileClose $0

  ; เขียน install-script.bat สำหรับ clone และ npm install
  FileOpen $0 "$TEMP\p4p-install.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title ติดตั้งระบบ P4P...$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo กำลัง Clone จาก GitHub...$\r$\n"
  FileWrite $0 "git clone https://github.com/tannamnaja-ui/p4p-management-.git $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "if errorlevel 1 ($\r$\n"
  FileWrite $0 "  echo Clone ไม่สำเร็จ ลองอัปเดตแทน...$\r$\n"
  FileWrite $0 "  cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "  git pull origin main$\r$\n"
  FileWrite $0 ")$\r$\n"
  FileWrite $0 "cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo กำลังติดตั้ง dependencies...$\r$\n"
  FileWrite $0 "npm install$\r$\n"
  FileWrite $0 "if not exist $\"$INSTDIR\config\settings.json$\" ($\r$\n"
  FileWrite $0 "  echo {$\"db_type$\":$\"postgresql$\",$\"db_host$\":$\"$\",$\"db_port$\":$\"5432$\",$\"db_user$\":$\"$\",$\"db_password$\":$\"$\",$\"db_name$\":$\"$\"} > $\"$INSTDIR\config\settings.json$\"$\r$\n"
  FileWrite $0 ")$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo ติดตั้งสำเร็จ!$\r$\n"
  FileClose $0

  ; รัน install script
  nsExec::ExecToLog '"cmd.exe" /c "$TEMP\p4p-install.bat"'

  ; สร้าง shortcut บน Desktop
  CreateShortcut "$DESKTOP\P4P System.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\start.bat" 0 SW_SHOWMINIMIZED

  ; สร้าง shortcut ใน Start Menu
  CreateDirectory "$SMPROGRAMS\P4P Management"
  CreateShortcut "$SMPROGRAMS\P4P Management\P4P System.lnk" "$INSTDIR\start.bat" "" "$INSTDIR\start.bat" 0
  CreateShortcut "$SMPROGRAMS\P4P Management\อัปเดตระบบ.lnk" "$INSTDIR\update.bat" "" "$INSTDIR\update.bat" 0
  CreateShortcut "$SMPROGRAMS\P4P Management\ถอนการติดตั้ง.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0

  ; เขียน registry
  WriteRegStr HKCU "Software\P4P-Management" "Install_Dir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

SectionEnd

;--------------------------------
; Uninstaller Section
Section "Uninstall"

  ; ลบ registry
  DeleteRegKey HKCU "Software\P4P-Management"

  ; ลบ shortcuts
  Delete "$DESKTOP\P4P System.lnk"
  RMDir /r "$SMPROGRAMS\P4P Management"

  ; ลบโฟลเดอร์ (ยกเว้น config)
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\public"
  RMDir /r "$INSTDIR\routes"
  RMDir /r "$INSTDIR\node_modules"
  Delete "$INSTDIR\server.js"
  Delete "$INSTDIR\start.bat"
  Delete "$INSTDIR\update.bat"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\package-lock.json"
  RMDir "$INSTDIR"

SectionEnd
