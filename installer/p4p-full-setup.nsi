; ============================================================
; P4P Management System - Full Auto Installer
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
BrandingText "ระบบ P4P Management v1.2"

; ---------- หน้าต้อนรับ ----------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "ต้องการยกเลิกการติดตั้งหรือไม่?"

!define MUI_WELCOMEPAGE_TITLE "ยินดีต้อนรับสู่ระบบ P4P"
!define MUI_WELCOMEPAGE_TEXT "โปรแกรมนี้จะติดตั้งระบบ P4P Management ให้อัตโนมัติ$\r$\n$\r$\n• รองรับ PostgreSQL และ MySQL$\r$\n• ติดตั้ง Node.js อัตโนมัติ (ถ้ายังไม่มี)$\r$\n• ติดตั้ง dependencies ทั้งหมด$\r$\n• สร้าง Shortcut บน Desktop$\r$\n$\r$\nต้องการการเชื่อมต่ออินเทอร์เน็ตในครั้งแรก$\r$\n$\r$\nกดถัดไปเพื่อเริ่มติดตั้ง"

!define MUI_DIRECTORYPAGE_TEXT_TOP "เลือกโฟลเดอร์สำหรับติดตั้งระบบ P4P"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "โฟลเดอร์ติดตั้ง"

!define MUI_INSTFILESPAGE_HEADER_TEXT "กำลังติดตั้งระบบ P4P..."
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "กรุณารอสักครู่ ห้ามปิดโปรแกรมนี้"
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "ติดตั้งสำเร็จ"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "ระบบ P4P พร้อมใช้งาน"

!define MUI_FINISHPAGE_TITLE "ติดตั้งเสร็จสิ้น!"
!define MUI_FINISHPAGE_TEXT "ติดตั้งระบบ P4P เรียบร้อยแล้ว$\r$\n$\r$\nวิธีเปิดใช้งาน:$\r$\n  • ดับเบิ้ลคลิก P4P Management บน Desktop$\r$\n  • หรือเปิดเบราว์เซอร์ที่ http://localhost:3009$\r$\n$\r$\nกรุณาตั้งค่าฐานข้อมูลก่อนใช้งานครั้งแรก"
!define MUI_FINISHPAGE_RUN "$INSTDIR\start-p4p.bat"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดระบบ P4P ทันที"

!define MUI_UNCONFIRMPAGE_TEXT_TOP "โปรแกรมจะถอนการติดตั้งระบบ P4P ออกจากเครื่อง"

; ---------- Pages ----------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; ภาษาไทย (ต้องอยู่หลัง pages เสมอ)
!insertmacro MUI_LANGUAGE "Thai"

; ============================================================
; INSTALL SECTION
; ============================================================
Section "ติดตั้ง" SecMain

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; ======== 1. คัดลอกไฟล์โปรแกรม (ซ่อนข้อความภาษาอังกฤษ) ========
  SetDetailsPrint none

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

  ; กลับมาแสดงข้อความ
  SetDetailsPrint textonly
  DetailPrint "คัดลอกไฟล์โปรแกรมสำเร็จ"

  ; ======== 2. ตรวจสอบ Node.js ========
  DetailPrint "กำลังตรวจสอบ Node.js..."

  StrCpy $R0 "notfound"

  ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
    StrCpy $R0 "found"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
    StrCpy $R0 "found"
  ${Else}
    SetDetailsPrint none
    nsExec::ExecToStack '"cmd.exe" /c "where node 2>nul"'
    Pop $0
    Pop $1
    SetDetailsPrint textonly
    ${If} $0 == 0
      StrCpy $R0 "found"
    ${EndIf}
  ${EndIf}

  ${If} $R0 == "found"
    DetailPrint "พบ Node.js อยู่แล้ว ข้ามการติดตั้ง"
  ${Else}
    ; ไม่พบ Node.js — ต้องติดตั้ง
    DetailPrint "ไม่พบ Node.js กำลังเตรียมติดตั้ง..."

    ; ตรวจสอบว่ามีไฟล์ node-setup.msi ใน Temp แล้วหรือไม่
    ${If} ${FileExists} "$TEMP\node-setup.msi"
      DetailPrint "พบไฟล์ node-setup.msi แล้ว ข้ามการดาวน์โหลด..."
    ${Else}
      DetailPrint "กำลังดาวน์โหลด Node.js LTS (ประมาณ 30MB) กรุณารอ..."
      SetDetailsPrint none
      NSISdl::download /TIMEOUT=300000 \
        "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi" \
        "$TEMP\node-setup.msi"
      Pop $0
      SetDetailsPrint textonly
      ${If} $0 != "success"
        MessageBox MB_ICONEXCLAMATION|MB_OK "ดาวน์โหลด Node.js ไม่สำเร็จ ($0)$\r$\n$\r$\nกรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่"
        Abort
      ${EndIf}
      DetailPrint "ดาวน์โหลด Node.js สำเร็จ"
    ${EndIf}

    ; ติดตั้ง Node.js
    DetailPrint "กำลังติดตั้ง Node.js (อาจใช้เวลา 1-3 นาที) กรุณารอ..."
    SetDetailsPrint none
    nsExec::ExecToStack '"msiexec.exe" /i "$TEMP\node-setup.msi" /qn /norestart ADDLOCAL=ALL'
    Pop $0
    Pop $1
    SetDetailsPrint textonly

    ; ตรวจสอบผลการติดตั้ง Node.js โดยดูจากตำแหน่งไฟล์จริง
    ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
      DetailPrint "ติดตั้ง Node.js สำเร็จ"
    ${ElseIf} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
      DetailPrint "ติดตั้ง Node.js สำเร็จ"
    ${Else}
      ; ไฟล์ MSI อาจเสียหาย ลบแล้วแจ้งให้ลองใหม่
      Delete "$TEMP\node-setup.msi"
      MessageBox MB_ICONEXCLAMATION|MB_OK "ติดตั้ง Node.js ไม่สำเร็จ (รหัสผิดพลาด: $0)$\r$\n$\r$\nไฟล์ชั่วคราวถูกลบแล้ว กรุณาลองรันตัวติดตั้งใหม่อีกครั้ง"
      Abort
    ${EndIf}
  ${EndIf}

  ; ======== 3. สร้าง config เริ่มต้น ========
  DetailPrint "สร้างไฟล์ตั้งค่าเริ่มต้น..."
  ${IfNot} ${FileExists} "$INSTDIR\config\settings.json"
    FileOpen $0 "$INSTDIR\config\settings.json" w
    FileWrite $0 '{"db_type":"postgresql","db_host":"localhost","db_port":"5432","db_user":"","db_password":"","db_name":""}'
    FileClose $0
    DetailPrint "สร้างไฟล์ตั้งค่าสำเร็จ"
  ${Else}
    DetailPrint "พบไฟล์ตั้งค่าเดิม ไม่เขียนทับ"
  ${EndIf}

  ; ======== 4. npm install ========
  DetailPrint "กำลังติดตั้ง packages (รองรับ PostgreSQL + MySQL) กรุณารอ..."

  FileOpen $0 "$TEMP\p4p-npm.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "set PATH=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%PATH%$\r$\n"
  FileWrite $0 "cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "npm install --production --no-fund --no-audit --loglevel error 2>&1$\r$\n"
  FileClose $0

  SetDetailsPrint none
  nsExec::ExecToStack '"cmd.exe" /c "$TEMP\p4p-npm.bat"'
  Pop $0
  Pop $1
  SetDetailsPrint textonly

  ${If} $0 == 0
    DetailPrint "ติดตั้ง packages สำเร็จ"
  ${Else}
    DetailPrint "ติดตั้ง packages มีข้อผิดพลาด (ลองใหม่)..."
    SetDetailsPrint none
    nsExec::ExecToStack '"cmd.exe" /c "set PATH=C:\Program Files\nodejs;%PATH% && cd /d $\"$INSTDIR$\" && npm install --production --no-fund --no-audit"'
    Pop $0
    Pop $1
    SetDetailsPrint textonly
    DetailPrint "ติดตั้ง packages เสร็จสิ้น"
  ${EndIf}

  ; ======== 5. สร้าง Launcher ========
  DetailPrint "สร้างไฟล์เปิดระบบ..."

  FileOpen $0 "$INSTDIR\start-p4p.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "chcp 65001 >nul$\r$\n"
  FileWrite $0 "title ระบบ P4P Management$\r$\n"
  FileWrite $0 "cd /d $\"%~dp0$\"$\r$\n"
  FileWrite $0 "set PATH=C:\Program Files\nodejs;%PATH%$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo  ============================================$\r$\n"
  FileWrite $0 "echo       ระบบบริหาร P4P Management$\r$\n"
  FileWrite $0 "echo  ============================================$\r$\n"
  FileWrite $0 "echo.$\r$\n"
  FileWrite $0 "echo  กำลังเริ่มต้นระบบ...$\r$\n"
  FileWrite $0 "timeout /t 2 /nobreak >nul$\r$\n"
  FileWrite $0 "start $\"$\" http://localhost:3009$\r$\n"
  FileWrite $0 "node server.js$\r$\n"
  FileWrite $0 "pause$\r$\n"
  FileClose $0

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

  CreateShortcut "$DESKTOP\P4P Management.lnk" "$INSTDIR\start-p4p.bat" "" \
    "$SYSDIR\shell32.dll" 13 SW_SHOWNORMAL "" "ระบบบริหาร P4P Management"

  CreateDirectory "$SMPROGRAMS\P4P Management"
  CreateShortcut "$SMPROGRAMS\P4P Management\เปิดระบบ P4P.lnk" "$INSTDIR\start-p4p.bat" "" \
    "$SYSDIR\shell32.dll" 13
  CreateShortcut "$SMPROGRAMS\P4P Management\หยุดระบบ P4P.lnk" "$INSTDIR\stop-p4p.bat" "" \
    "$SYSDIR\shell32.dll" 27
  CreateShortcut "$SMPROGRAMS\P4P Management\ถอนการติดตั้ง.lnk" "$INSTDIR\Uninstall.exe"

  ; ======== 7. Registry ========
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "DisplayName" "P4P Management System"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "DisplayVersion" "1.2.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "Publisher" "P4P Management"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" \
    "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  SetDetailsPrint both
  DetailPrint ""
  DetailPrint "ติดตั้งระบบ P4P สำเร็จ!"
  DetailPrint "เปิดใช้งานได้ที่ http://localhost:3009"

SectionEnd

; ============================================================
; UNINSTALL SECTION
; ============================================================
Section "Uninstall"

  SetDetailsPrint textonly
  DetailPrint "หยุดระบบ P4P..."
  SetDetailsPrint none
  nsExec::ExecToStack '"taskkill" /F /IM node.exe /T'
  Pop $0
  Pop $1

  SetDetailsPrint textonly
  DetailPrint "ลบ registry..."
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management"

  DetailPrint "ลบ shortcuts..."
  Delete "$DESKTOP\P4P Management.lnk"
  RMDir /r "$SMPROGRAMS\P4P Management"

  DetailPrint "ลบไฟล์โปรแกรม..."
  SetDetailsPrint none
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
  ; เก็บ config\settings.json ไว้ (มีข้อมูลการเชื่อมต่อฐานข้อมูล)
  RMDir "$INSTDIR\config"
  RMDir "$INSTDIR"

  SetDetailsPrint textonly
  DetailPrint "ถอนการติดตั้งสำเร็จ"

SectionEnd
