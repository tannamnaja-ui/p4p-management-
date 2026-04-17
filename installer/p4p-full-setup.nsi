; ============================================================
; P4P Management System - Full Auto Installer
; โรงพยาบาลพุทธชินราช
; ============================================================

Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; ---------- ข้อมูลโปรแกรม ----------
Name "ระบบ P4P Management - โรงพยาบาลพุทธชินราช"
OutFile "P4P-Full-Setup.exe"
InstallDir "$PROGRAMFILES64\P4P-Management"
RequestExecutionLevel admin
BrandingText "P4P Management System v1.0 - โรงพยาบาลพุทธชินราช"

; ---------- UI ----------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "คุณต้องการยกเลิกการติดตั้งหรือไม่?"

!define MUI_WELCOMEPAGE_TITLE "ยินดีต้อนรับสู่ระบบ P4P Management"
!define MUI_WELCOMEPAGE_TEXT "โปรแกรมนี้จะติดตั้งระบบบริหาร P4P สำหรับโรงพยาบาลพุทธชินราช$\r$\n$\r$\n✓ ติดตั้ง Node.js อัตโนมัติ (ถ้ายังไม่มี)$\r$\n✓ ติดตั้ง dependencies ทั้งหมด$\r$\n✓ รองรับ PostgreSQL และ MySQL$\r$\n✓ สร้าง Shortcut บน Desktop$\r$\n$\r$\nต้องการการเชื่อมต่ออินเทอร์เน็ตในครั้งแรก$\r$\n$\r$\nกดถัดไปเพื่อเริ่มติดตั้ง"

!define MUI_DIRECTORYPAGE_TEXT_TOP "เลือกโฟลเดอร์สำหรับติดตั้งระบบ P4P"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "โฟลเดอร์ติดตั้ง"

!define MUI_INSTFILESPAGE_HEADER_TEXT "กำลังติดตั้งระบบ P4P..."
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "กรุณารอสักครู่"
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "ติดตั้งสำเร็จ"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "ระบบ P4P พร้อมใช้งาน"

!define MUI_FINISHPAGE_TITLE "ติดตั้งสำเร็จ!"
!define MUI_FINISHPAGE_TEXT "ติดตั้งระบบ P4P เรียบร้อยแล้ว$\r$\n$\r$\nวิธีเปิดใช้งาน:$\r$\n• ดับเบิ้ลคลิก 'P4P Management' บน Desktop$\r$\n• เปิดเบราว์เซอร์ที่ http://localhost:3009$\r$\n• ตั้งค่าการเชื่อมต่อฐานข้อมูล"
!define MUI_FINISHPAGE_RUN "$INSTDIR\start-p4p.bat"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดระบบ P4P เดี๋ยวนี้"

!define MUI_UNCONFIRMPAGE_TEXT_TOP "โปรแกรมจะถอนการติดตั้งระบบ P4P ออกจากเครื่องของคุณ"
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ภาษาไทย (ต้องอยู่หลัง pages)
!insertmacro MUI_LANGUAGE "Thai"

; ============================================================
; INSTALL
; ============================================================
Section "ติดตั้งระบบ P4P" SecMain

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; ======== 1. EXTRACT ไฟล์ทั้งหมด ========
  DetailPrint "กำลัง extract ไฟล์โปรแกรม..."

  File "..\server.js"
  File "..\package.json"
  File "..\package-lock.json"
  File "..\create-tables.js"

  SetOutPath "$INSTDIR\config"
  File "..\config\db.js"

  SetOutPath "$INSTDIR\routes"
  File "..\routes\auth.js"
  File "..\routes\data.js"
  File "..\routes\p4p.js"
  File "..\routes\settings.js"

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
  DetailPrint "Extract ไฟล์สำเร็จ"

  ; ======== 2. ตรวจสอบและติดตั้ง Node.js ========
  DetailPrint "กำลังตรวจสอบ Node.js..."

  ; ตรวจสอบ node.exe หลายตำแหน่ง
  ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
    StrCpy $R0 "$PROGRAMFILES64\nodejs\node.exe"
    Goto NodeFound
  ${ElseIf} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
    StrCpy $R0 "$PROGRAMFILES\nodejs\node.exe"
    Goto NodeFound
  ${EndIf}

  ; ลอง where node
  nsExec::ExecToStack '"cmd.exe" /c "node -v 2>nul"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    DetailPrint "พบ Node.js: $1"
    Goto NodeFound
  ${EndIf}

  ; ไม่พบ Node.js — ดาวน์โหลด
  DetailPrint "ไม่พบ Node.js กำลังดาวน์โหลด (Node.js LTS v20)..."
  DetailPrint "กรุณารอสักครู่ ขนาดไฟล์ประมาณ 30MB..."

  ${If} ${FileExists} "$TEMP\node-setup.msi"
    DetailPrint "พบไฟล์ node-setup.msi เดิม ใช้ไฟล์นี้..."
    Goto InstallNode
  ${EndIf}

  NSISdl::download /TIMEOUT=180000 \
    "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi" \
    "$TEMP\node-setup.msi"
  Pop $0
  ${If} $0 != "success"
    MessageBox MB_ICONEXCLAMATION|MB_OK "ดาวน์โหลด Node.js ไม่สำเร็จ ($0)$\r$\n$\r$\nกรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่"
    Abort
  ${EndIf}
  DetailPrint "ดาวน์โหลด Node.js สำเร็จ"

  InstallNode:
  DetailPrint "กำลังติดตั้ง Node.js (อาจใช้เวลา 1-2 นาที)..."
  nsExec::ExecToLog '"msiexec.exe" /i "$TEMP\node-setup.msi" /qn /norestart ADDLOCAL=ALL'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "ติดตั้ง Node.js ไม่สำเร็จ (error: $0)$\r$\n$\r$\nกรุณาติดตั้ง Node.js เองที่ https://nodejs.org แล้วรันติดตั้งใหม่"
    Abort
  ${EndIf}
  DetailPrint "ติดตั้ง Node.js สำเร็จ"

  NodeFound:
  DetailPrint "Node.js พร้อมใช้งาน"

  ; ======== 3. สร้าง config เริ่มต้น ========
  DetailPrint "สร้างไฟล์ config..."
  ${If} ${FileExists} "$INSTDIR\config\settings.json"
    DetailPrint "พบ config เดิม ไม่เขียนทับ"
  ${Else}
    FileOpen $0 "$INSTDIR\config\settings.json" w
    FileWrite $0 '{"db_type":"postgresql","db_host":"localhost","db_port":"5432","db_user":"","db_password":"","db_name":""}'
    FileClose $0
    DetailPrint "สร้าง config สำเร็จ"
  ${EndIf}

  ; ======== 4. npm install ========
  DetailPrint "กำลังติดตั้ง Node.js packages (รองรับ PostgreSQL + MySQL)..."
  DetailPrint "อาจใช้เวลา 1-3 นาที กรุณารอ..."

  ; เพิ่ม nodejs path แล้วรัน npm install
  FileOpen $0 "$TEMP\p4p-npm.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs$\r$\n"
  FileWrite $0 "cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "npm install --production 2>&1$\r$\n"
  FileClose $0

  nsExec::ExecToLog '"cmd.exe" /c "$TEMP\p4p-npm.bat"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "npm install มีข้อผิดพลาด ลองใหม่..."
    nsExec::ExecToLog '"cmd.exe" /c "set PATH=%PATH%;C:\Program Files\nodejs && cd /d $\"$INSTDIR$\" && npm install --production"'
    Pop $0
  ${EndIf}
  DetailPrint "ติดตั้ง packages สำเร็จ (pg + mysql2)"

  ; ======== 5. สร้าง Launchers ========
  DetailPrint "สร้าง Launcher..."

  ; start-p4p.bat
  FileOpen $0 "$INSTDIR\start-p4p.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title ระบบ P4P Management - โรงพยาบาลพุทธชินราช$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "set PATH=%PATH%;C:\Program Files\nodejs$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo  ╔══════════════════════════════════════════╗$\r$\n"
  FileWrite $0 "echo  ║    ระบบบริหาร P4P - รพ.พุทธชินราช       ║$\r$\n"
  FileWrite $0 "echo  ╚══════════════════════════════════════════╝$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo  กำลังเริ่มต้นระบบ...$\r$\n"
  FileWrite $0 "timeout /t 2 /nobreak >nul$\r$\n"
  FileWrite $0 "start $\"$\" http://localhost:3009$\r$\n"
  FileWrite $0 "node server.js$\r$\n"
  FileWrite $0 "pause$\r$\n"
  FileClose $0

  ; stop-p4p.bat
  FileOpen $0 "$INSTDIR\stop-p4p.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "echo หยุดระบบ P4P...$\r$\n"
  FileWrite $0 "taskkill /F /IM node.exe /T >nul 2>&1$\r$\n"
  FileWrite $0 "echo หยุดระบบแล้ว$\r$\n"
  FileWrite $0 "timeout /t 2 /nobreak >nul$\r$\n"
  FileClose $0

  ; ======== 6. Shortcuts ========
  DetailPrint "สร้าง Shortcuts..."

  CreateShortcut "$DESKTOP\P4P Management.lnk" \
    "$INSTDIR\start-p4p.bat" "" \
    "$SYSDIR\shell32.dll" 13 \
    SW_SHOWNORMAL "" "ระบบบริหาร P4P โรงพยาบาลพุทธชินราช"

  CreateDirectory "$SMPROGRAMS\P4P Management"
  CreateShortcut "$SMPROGRAMS\P4P Management\เปิดระบบ P4P.lnk" \
    "$INSTDIR\start-p4p.bat" "" "$SYSDIR\shell32.dll" 13
  CreateShortcut "$SMPROGRAMS\P4P Management\หยุดระบบ P4P.lnk" \
    "$INSTDIR\stop-p4p.bat" "" "$SYSDIR\shell32.dll" 27
  CreateShortcut "$SMPROGRAMS\P4P Management\ถอนการติดตั้ง.lnk" \
    "$INSTDIR\Uninstall.exe"

  ; ======== 7. Registry (Add/Remove Programs) ========
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "DisplayName" "P4P Management System - โรงพยาบาลพุทธชินราช"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "Publisher" "โรงพยาบาลพุทธชินราช"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "URLInfoAbout" "https://github.com/tannamnaja-ui/p4p-management-"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  DetailPrint ""
  DetailPrint "✓ ติดตั้งระบบ P4P สำเร็จ!"
  DetailPrint "✓ เปิดใช้งานได้ที่ http://localhost:3009"

SectionEnd

; ============================================================
; UNINSTALL
; ============================================================
Section "Uninstall"

  DetailPrint "หยุดระบบ P4P..."
  nsExec::ExecToLog '"taskkill" /F /IM node.exe /T'

  DetailPrint "ลบ registry..."
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management"

  DetailPrint "ลบ shortcuts..."
  Delete "$DESKTOP\P4P Management.lnk"
  RMDir /r "$SMPROGRAMS\P4P Management"

  DetailPrint "ลบไฟล์โปรแกรม..."
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
  Delete "$INSTDIR\config\db.js"
  ; เก็บ settings.json ไว้ (มี DB credentials)
  RMDir "$INSTDIR\config"
  RMDir "$INSTDIR"

  DetailPrint "ถอนการติดตั้งสำเร็จ"

SectionEnd
