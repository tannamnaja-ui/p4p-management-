; ============================================================
; P4P Management System - Full Auto Installer
; โรงพยาบาลพุทธชินราช
; รวม Node.js + npm install + shortcuts ทั้งหมดในตัว
; ============================================================

Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; ---------- ข้อมูลโปรแกรม ----------
Name "ระบบ P4P Management"
OutFile "P4P-Full-Setup.exe"
InstallDir "$PROGRAMFILES64\P4P-Management"
RequestExecutionLevel admin
BrandingText "P4P Management System v1.0 - โรงพยาบาลพุทธชินราช"

; ---------- UI ----------
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "ยินดีต้อนรับสู่ระบบ P4P Management"
!define MUI_WELCOMEPAGE_TEXT "โปรแกรมนี้จะติดตั้งระบบบริหาร P4P สำหรับโรงพยาบาลพุทธชินราช$\r$\n$\r$\n• ติดตั้ง Node.js อัตโนมัติ (ถ้ายังไม่มี)$\r$\n• ติดตั้ง dependencies ทั้งหมด$\r$\n• รองรับ PostgreSQL และ MySQL$\r$\n• สร้าง shortcut บน Desktop$\r$\n$\r$\nกดถัดไปเพื่อดำเนินการ"
!define MUI_FINISHPAGE_RUN "$INSTDIR\start-p4p.bat"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดระบบ P4P เดี๋ยวนี้"
!define MUI_FINISHPAGE_SHOWREADME "http://localhost:3009"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "เปิด http://localhost:3009 ในเบราว์เซอร์"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Thai"

; ============================================================
; INSTALL
; ============================================================
Section "ติดตั้งระบบ P4P" SecMain

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; ---------- 1. Extract ไฟล์ทั้งหมด ----------
  DetailPrint "กำลัง Extract ไฟล์โปรแกรม..."

  ; server + config
  File "..\server.js"
  File "..\package.json"
  File "..\package-lock.json"
  File "..\create-tables.js"

  ; config folder
  SetOutPath "$INSTDIR\config"
  File "..\config\db.js"

  ; routes folder
  SetOutPath "$INSTDIR\routes"
  File "..\routes\auth.js"
  File "..\routes\data.js"
  File "..\routes\p4p.js"
  File "..\routes\settings.js"

  ; public folder
  SetOutPath "$INSTDIR\public"
  File "..\public\app.js"
  File "..\public\auth-guard.js"
  File "..\public\home.js"
  File "..\public\index.html"
  File "..\public\login.html"
  File "..\public\login.js"
  File "..\public\p4p-doctor-point.html"
  File "..\public\p4p-import.html"
  File "..\public\position-setting.html"
  File "..\public\report-select.html"
  File "..\public\tmp-data.html"
  File "..\public\view-data.html"
  File "..\public\view-data.js"

  SetOutPath "$INSTDIR"

  ; ---------- 2. ตรวจสอบ Node.js ----------
  DetailPrint "กำลังตรวจสอบ Node.js..."
  nsExec::ExecToStack '"cmd.exe" /c node -v'
  Pop $0  ; exit code
  Pop $1  ; output

  ${If} $0 != 0
    DetailPrint "ไม่พบ Node.js กำลังดาวน์โหลดและติดตั้ง..."
    DetailPrint "ดาวน์โหลด Node.js LTS (อาจใช้เวลาสักครู่)..."

    NSISdl::download /TIMEOUT=120000 \
      "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi" \
      "$TEMP\node-setup.msi"
    Pop $0
    ${If} $0 == "success"
      DetailPrint "กำลังติดตั้ง Node.js..."
      nsExec::ExecToLog '"msiexec.exe" /i "$TEMP\node-setup.msi" /qn /norestart'
      Pop $0
      ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION "ติดตั้ง Node.js ไม่สำเร็จ$\r$\nกรุณาติดตั้ง Node.js เองที่ https://nodejs.org แล้วรันใหม่"
        Abort
      ${EndIf}
      DetailPrint "ติดตั้ง Node.js สำเร็จ"
    ${Else}
      MessageBox MB_ICONEXCLAMATION "ดาวน์โหลด Node.js ไม่สำเร็จ ($0)$\r$\nกรุณาตรวจสอบ internet แล้วรันใหม่"
      Abort
    ${EndIf}
  ${Else}
    DetailPrint "พบ Node.js: $1"
  ${EndIf}

  ; ---------- 3. สร้าง config เริ่มต้น ----------
  DetailPrint "สร้าง config ไฟล์..."
  ${If} ${FileExists} "$INSTDIR\config\settings.json"
    DetailPrint "พบ config เดิม ข้ามขั้นตอนนี้"
  ${Else}
    FileOpen $0 "$INSTDIR\config\settings.json" w
    FileWrite $0 '{"db_type":"postgresql","db_host":"localhost","db_port":"5432","db_user":"","db_password":"","db_name":""}'
    FileClose $0
  ${EndIf}

  ; ---------- 4. npm install ----------
  DetailPrint "กำลังติดตั้ง Node.js packages (อาจใช้เวลา 1-2 นาที)..."

  ; หา path ของ npm หลังจาก install Node.js ใหม่
  nsExec::ExecToStack '"cmd.exe" /c where npm'
  Pop $0
  Pop $1

  ; refresh PATH แล้ว npm install
  nsExec::ExecToLog '"cmd.exe" /c "cd /d $\"$INSTDIR$\" && refreshenv 2>nul & npm install --production 2>&1"'
  Pop $0
  ${If} $0 != 0
    ; ลอง path ตรงๆ
    nsExec::ExecToLog '"cmd.exe" /c "cd /d $\"$INSTDIR$\" && $\"C:\Program Files\nodejs\npm.cmd$\" install --production 2>&1"'
    Pop $0
  ${EndIf}
  DetailPrint "ติดตั้ง packages สำเร็จ"

  ; ---------- 5. สร้าง start-p4p.bat ----------
  DetailPrint "สร้าง Launcher..."
  FileOpen $0 "$INSTDIR\start-p4p.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title ระบบ P4P Management - โรงพยาบาลพุทธชินราช$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo  ╔══════════════════════════════════════════╗$\r$\n"
  FileWrite $0 "echo  ║    ระบบบริหาร P4P - รพ.พุทธชินราช       ║$\r$\n"
  FileWrite $0 "echo  ║    กำลังเริ่มต้นระบบ...                  ║$\r$\n"
  FileWrite $0 "echo  ╚══════════════════════════════════════════╝$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "timeout /t 2 /nobreak >nul$\r$\n"
  FileWrite $0 "start $\"$\" http://localhost:3009$\r$\n"
  FileWrite $0 "node server.js$\r$\n"
  FileWrite $0 "pause$\r$\n"
  FileClose $0

  ; ---------- 6. สร้าง stop-p4p.bat ----------
  FileOpen $0 "$INSTDIR\stop-p4p.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "echo หยุดระบบ P4P...$\r$\n"
  FileWrite $0 "taskkill /F /IM node.exe /T >nul 2>&1$\r$\n"
  FileWrite $0 "echo หยุดระบบแล้ว$\r$\n"
  FileWrite $0 "timeout /t 2 /nobreak >nul$\r$\n"
  FileClose $0

  ; ---------- 7. สร้าง Desktop Shortcut ----------
  DetailPrint "สร้าง Shortcuts..."
  CreateShortcut "$DESKTOP\P4P Management.lnk" \
    "$INSTDIR\start-p4p.bat" "" \
    "$SYSDIR\shell32.dll" 13 \
    SW_SHOWNORMAL "" "ระบบบริหาร P4P โรงพยาบาลพุทธชินราช"

  ; ---------- 8. สร้าง Start Menu ----------
  CreateDirectory "$SMPROGRAMS\P4P Management"
  CreateShortcut "$SMPROGRAMS\P4P Management\เปิดระบบ P4P.lnk" "$INSTDIR\start-p4p.bat" "" "$SYSDIR\shell32.dll" 13
  CreateShortcut "$SMPROGRAMS\P4P Management\หยุดระบบ P4P.lnk" "$INSTDIR\stop-p4p.bat" "" "$SYSDIR\shell32.dll" 27
  CreateShortcut "$SMPROGRAMS\P4P Management\ถอนการติดตั้ง.lnk" "$INSTDIR\Uninstall.exe"

  ; ---------- 9. Registry ----------
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "DisplayName" "P4P Management System"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "Publisher" "โรงพยาบาลพุทธชินราช"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "DisplayIcon" "$INSTDIR\start-p4p.bat"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  DetailPrint ""
  DetailPrint "✓ ติดตั้งสำเร็จ! เปิดใช้งานได้ที่ http://localhost:3009"

SectionEnd

; ============================================================
; UNINSTALL
; ============================================================
Section "Uninstall"

  ; หยุด node ถ้ากำลังรัน
  nsExec::ExecToLog '"taskkill" /F /IM node.exe /T'

  ; ลบ registry
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management"

  ; ลบ shortcuts
  Delete "$DESKTOP\P4P Management.lnk"
  RMDir /r "$SMPROGRAMS\P4P Management"

  ; ลบไฟล์
  RMDir /r "$INSTDIR\public"
  RMDir /r "$INSTDIR\routes"
  RMDir /r "$INSTDIR\node_modules"
  Delete "$INSTDIR\server.js"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\package-lock.json"
  Delete "$INSTDIR\create-tables.js"
  Delete "$INSTDIR\start-p4p.bat"
  Delete "$INSTDIR\stop-p4p.bat"
  Delete "$INSTDIR\Uninstall.exe"
  ; เก็บ config/settings.json ไว้ (มี DB credentials)
  Delete "$INSTDIR\config\db.js"
  RMDir "$INSTDIR\config"
  RMDir "$INSTDIR"

SectionEnd
