; P4P Management System - Full Auto Installer
Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

Name "ระบบ P4P Management"
OutFile "P4P-Full-Setup.exe"
InstallDir "$PROGRAMFILES64\P4P-Management"
RequestExecutionLevel admin
BrandingText "ระบบ P4P Management v1.3"

!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "ต้องการยกเลิกการติดตั้งหรือไม่?"

!define MUI_DIRECTORYPAGE_TEXT_TOP "เลือกโฟลเดอร์สำหรับติดตั้งระบบ P4P"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "โฟลเดอร์ติดตั้ง"

!define MUI_INSTFILESPAGE_HEADER_TEXT "กำลังติดตั้งระบบ P4P..."
!define MUI_INSTFILESPAGE_HEADER_SUBTEXT "กรุณารอสักครู่ ห้ามปิดโปรแกรมนี้"
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "ติดตั้งสำเร็จ"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "ระบบ P4P พร้อมใช้งาน"

!define MUI_FINISHPAGE_TITLE "ติดตั้งเสร็จสิ้น!"
!define MUI_FINISHPAGE_TEXT "ติดตั้งระบบ P4P เรียบร้อยแล้ว$\r$\n$\r$\nวิธีเปิดใช้งาน:$\r$\n  ดับเบิ้ลคลิก P4P Management บน Desktop$\r$\n  หรือเปิดเบราว์เซอร์: http://localhost:3009$\r$\n$\r$\nกรุณาตั้งค่าฐานข้อมูลก่อนใช้งานครั้งแรก"
!define MUI_FINISHPAGE_RUN "$INSTDIR\start-p4p.bat"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดระบบ P4P ทันที"

; ไม่มีหน้า Welcome (หลีกเลี่ยงปัญหา font)
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Thai"

; ============================================================
Section "ติดตั้ง" SecMain

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; --- คัดลอกไฟล์ (ซ่อน output ภาษาอังกฤษ) ---
  SetDetailsPrint none
  ; bundle Node.js MSI ไว้ใน TEMP ก่อน (ไม่ต้องใช้ internet)
  File "/oname=$TEMP\node-setup.msi" "node-v20.19.0-x64.msi"
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
  SetDetailsPrint textonly
  DetailPrint "คัดลอกไฟล์โปรแกรมสำเร็จ"

  ; --- ตรวจสอบ Node.js หลายตำแหน่ง ---
  DetailPrint "กำลังตรวจสอบ Node.js..."
  StrCpy $R0 "notfound"
  ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
    StrCpy $R0 "found"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
    StrCpy $R0 "found"
  ${ElseIf} ${FileExists} "$LOCALAPPDATA\Programs\nodejs\node.exe"
    StrCpy $R0 "found"
  ${Else}
    SetDetailsPrint none
    nsExec::ExecToStack '"cmd.exe" /c "node -v 2>nul"'
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
    DetailPrint "กำลังติดตั้ง Node.js (1-3 นาที) กรุณารอ..."
    SetDetailsPrint none
    nsExec::ExecToStack '"msiexec.exe" /i "$TEMP\node-setup.msi" /qn /norestart ADDLOCAL=ALL'
    Pop $0
    Pop $1
    SetDetailsPrint textonly

    ; ตรวจสอบว่า Node.js พร้อมใช้งานหลังติดตั้ง
    StrCpy $R2 "notfound"
    ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
      StrCpy $R2 "found"
    ${ElseIf} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
      StrCpy $R2 "found"
    ${ElseIf} ${FileExists} "$LOCALAPPDATA\Programs\nodejs\node.exe"
      StrCpy $R2 "found"
    ${EndIf}

    ${If} $R2 == "found"
      DetailPrint "ติดตั้ง Node.js สำเร็จ"
    ${Else}
      MessageBox MB_ICONEXCLAMATION|MB_OK "ติดตั้ง Node.js ไม่สำเร็จ (รหัส: $0)$\r$\nกรุณาลองรันตัวติดตั้งใหม่"
      Abort
    ${EndIf}
  ${EndIf}

  ; --- สร้าง config ---
  DetailPrint "สร้างไฟล์ตั้งค่า..."
  ${IfNot} ${FileExists} "$INSTDIR\config\settings.json"
    FileOpen $0 "$INSTDIR\config\settings.json" w
    FileWrite $0 '{"db_type":"postgresql","db_host":"localhost","db_port":"5432","db_user":"","db_password":"","db_name":""}'
    FileClose $0
    DetailPrint "สร้างไฟล์ตั้งค่าสำเร็จ"
  ${Else}
    DetailPrint "พบไฟล์ตั้งค่าเดิม ไม่เขียนทับ"
  ${EndIf}

  ; --- npm install ---
  DetailPrint "กำลังติดตั้ง packages (PostgreSQL + MySQL) กรุณารอ..."
  FileOpen $0 "$TEMP\p4p-npm.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "set PATH=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%PATH%$\r$\n"
  FileWrite $0 "cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "npm install --production --no-fund --no-audit --loglevel error$\r$\n"
  FileClose $0
  SetDetailsPrint none
  nsExec::ExecToStack '"cmd.exe" /c "$TEMP\p4p-npm.bat"'
  Pop $0
  Pop $1
  SetDetailsPrint textonly
  DetailPrint "ติดตั้ง packages สำเร็จ"

  ; --- สร้าง Launcher ---
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

  ; --- Shortcuts ---
  DetailPrint "สร้าง Shortcuts..."
  CreateShortcut "$DESKTOP\P4P Management.lnk" "$INSTDIR\start-p4p.bat" "" "$SYSDIR\shell32.dll" 13 SW_SHOWNORMAL "" "ระบบบริหาร P4P Management"
  CreateDirectory "$SMPROGRAMS\P4P Management"
  CreateShortcut "$SMPROGRAMS\P4P Management\เปิดระบบ P4P.lnk" "$INSTDIR\start-p4p.bat" "" "$SYSDIR\shell32.dll" 13
  CreateShortcut "$SMPROGRAMS\P4P Management\หยุดระบบ P4P.lnk" "$INSTDIR\stop-p4p.bat" "" "$SYSDIR\shell32.dll" 27
  CreateShortcut "$SMPROGRAMS\P4P Management\ถอนการติดตั้ง.lnk" "$INSTDIR\Uninstall.exe"

  ; --- Registry ---
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "DisplayName" "P4P Management System"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "DisplayVersion" "1.3.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "Publisher" "P4P Management"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\P4P-Management" "NoRepair" 1
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  SetDetailsPrint both
  DetailPrint ""
  DetailPrint "ติดตั้งระบบ P4P สำเร็จ!"
  DetailPrint "เปิดใช้งานได้ที่ http://localhost:3009"

SectionEnd

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
  RMDir "$INSTDIR\config"
  RMDir "$INSTDIR"
  SetDetailsPrint textonly
  DetailPrint "ถอนการติดตั้งสำเร็จ"
SectionEnd
