; ============================================================
; P4P Hospital Installer
; ติดตั้งได้แบบ Offline ไม่ต้องการอินเทอร์เน็ต
; ============================================================

Unicode True
SetCompressor /SOLID lzma

!define APPNAME    "P4P Hospital"
!define APPVERSION "1.0.0"
!define PUBLISHER  "โรงพยาบาล"
!define INSTKEY    "SOFTWARE\P4P-Hospital"
!define UNINSTKEY  "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\P4PHospital"
!define PORT       "3009"

RequestExecutionLevel admin

Name "${APPNAME}"
OutFile "P4P_Hospital.exe"
InstallDir "$PROGRAMFILES64\P4P-Hospital"
InstallDirRegKey HKLM "${INSTKEY}" "InstallDir"

; ============================================================
; UI
; ============================================================
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "ยินดีต้อนรับสู่ตัวติดตั้ง ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "ตัวติดตั้งนี้จะติดตั้ง ${APPNAME} v${APPVERSION}$\r$\n$\r$\n\
• Node.js ถูกรวมไว้ในตัวติดตั้ง (ไม่ต้องการอินเทอร์เน็ต)$\r$\n\
• ถ้า Node.js มีอยู่แล้ว จะข้ามขั้นตอนนั้น$\r$\n\
• โปรแกรมเปิดผ่านเว็บเบราว์เซอร์ ไม่มีหน้าต่าง Command Prompt$\r$\n$\r$\n\
กด ถัดไป เพื่อดำเนินการต่อ"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "ติดตั้ง ${APPNAME} เสร็จสมบูรณ์"
!define MUI_FINISHPAGE_TEXT "ติดตั้งโปรแกรมเสร็จเรียบร้อยแล้ว$\r$\n$\r$\n\
สามารถเปิดโปรแกรมได้จาก Shortcut $\"P4P Hospital$\" บน Desktop$\r$\n$\r$\n\
ครั้งแรกที่ใช้งาน กรุณาตั้งค่าการเชื่อมต่อฐานข้อมูลในหน้าตั้งค่า"
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "เปิด ${APPNAME} ทันที"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Thai"

; ============================================================
; Function: เปิดโปรแกรมหลังติดตั้ง
; ============================================================
Function LaunchApp
  Exec '"$SYSDIR\wscript.exe" "$INSTDIR\start-p4p.vbs"'
FunctionEnd

; ============================================================
; Install Section
; ============================================================
Section "ติดตั้งโปรแกรม" SecMain

  SetDetailsPrint both

  ; ----------------------------------------------------------
  ; ตรวจสอบ Node.js (ข้ามถ้ามีอยู่แล้ว)
  ; ----------------------------------------------------------
  DetailPrint "กำลังตรวจสอบ Node.js..."

  ReadRegStr $0 HKLM "SOFTWARE\Node.js" "InstallPath"
  ${If} $0 != ""
    DetailPrint "Node.js มีอยู่แล้ว [$0] ข้ามการติดตั้ง"
    Goto NodeOK
  ${EndIf}

  ReadRegStr $0 HKCU "SOFTWARE\Node.js" "InstallPath"
  ${If} $0 != ""
    DetailPrint "Node.js มีอยู่แล้ว [$0] ข้ามการติดตั้ง"
    Goto NodeOK
  ${EndIf}

  ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
    DetailPrint "Node.js มีอยู่แล้วที่ $PROGRAMFILES64\nodejs ข้ามการติดตั้ง"
    Goto NodeOK
  ${EndIf}

  ${If} ${FileExists} "$LOCALAPPDATA\Programs\nodejs\node.exe"
    DetailPrint "Node.js มีอยู่แล้วที่ $LOCALAPPDATA\Programs\nodejs ข้ามการติดตั้ง"
    Goto NodeOK
  ${EndIf}

  ; ติดตั้ง Node.js แบบ Silent
  DetailPrint "ไม่พบ Node.js - กำลังติดตั้ง Node.js v20.19.0..."
  SetOutPath "$TEMP\p4p-node"
  File "node-v20.19.0-x64.msi"
  ExecWait 'msiexec /i "$TEMP\p4p-node\node-v20.19.0-x64.msi" /quiet /norestart ADDLOCAL=ALL' $R0
  Delete "$TEMP\p4p-node\node-v20.19.0-x64.msi"
  RMDir "$TEMP\p4p-node"
  DetailPrint "ติดตั้ง Node.js เสร็จแล้ว"

  NodeOK:

  ; ----------------------------------------------------------
  ; คัดลอกไฟล์โปรแกรม
  ; ----------------------------------------------------------
  DetailPrint "กำลังคัดลอกไฟล์โปรแกรม..."

  SetOutPath "$INSTDIR"
  File "..\server.js"
  File "..\package.json"
  File "..\create-tables.js"

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

  SetOutPath "$INSTDIR\routes"
  File "..\routes\auth.js"
  File "..\routes\data.js"
  File "..\routes\p4p.js"
  File "..\routes\settings.js"

  SetOutPath "$INSTDIR\config"
  File "..\config\db.js"

  SetOutPath "$INSTDIR\table"
  File "..\table\p4p_doctor_point.cds"
  File "..\table\p4p_doctor_point.zip"
  File "..\table\tmp_p4p_point.cds"
  File "..\table\tmp_p4p_point.zip"

  ; node_modules รวมไว้แล้ว ไม่ต้อง npm install
  DetailPrint "กำลังคัดลอก node_modules (อาจใช้เวลาสักครู่)..."
  SetOutPath "$INSTDIR\node_modules"
  File /r "..\node_modules\*"

  ; ----------------------------------------------------------
  ; สร้าง config/settings.json ถ้ายังไม่มี (ไม่ทับค่าเดิม)
  ; ----------------------------------------------------------
  SetOutPath "$INSTDIR\config"
  ${IfNot} ${FileExists} "$INSTDIR\config\settings.json"
    FileOpen $1 "$INSTDIR\config\settings.json" w
    FileWrite $1 '{$\r$\n'
    FileWrite $1 '  "db_type": "",$\r$\n'
    FileWrite $1 '  "db_host": "",$\r$\n'
    FileWrite $1 '  "db_port": 5432,$\r$\n'
    FileWrite $1 '  "db_user": "",$\r$\n'
    FileWrite $1 '  "db_password": "",$\r$\n'
    FileWrite $1 '  "db_name": ""$\r$\n'
    FileWrite $1 '}$\r$\n'
    FileClose $1
  ${EndIf}

  ; สร้าง .env ถ้ายังไม่มี
  SetOutPath "$INSTDIR"
  ${IfNot} ${FileExists} "$INSTDIR\.env"
    FileOpen $1 "$INSTDIR\.env" w
    FileWrite $1 "PORT=${PORT}$\r$\n"
    FileWrite $1 "NODE_ENV=production$\r$\n"
    FileClose $1
  ${EndIf}

  ; ----------------------------------------------------------
  ; สร้าง VBScript Launcher (เปิดโปรแกรมโดยไม่มี CMD window)
  ; ----------------------------------------------------------
  DetailPrint "สร้าง Launcher..."
  SetOutPath "$INSTDIR"

  FileOpen $1 "$INSTDIR\start-p4p.vbs" w
  FileWrite $1 "Dim objShell, nResult$\r$\n"
  FileWrite $1 "Set objShell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $1 "$\r$\n"
  FileWrite $1 "' ตรวจว่าเซิร์ฟเวอร์ทำงานอยู่แล้วหรือไม่ (port ${PORT})$\r$\n"
  FileWrite $1 "nResult = objShell.Run($\"cmd /c netstat -an | findstr :${PORT} > nul 2>&1$\", 0, True)$\r$\n"
  FileWrite $1 "If nResult <> 0 Then$\r$\n"
  FileWrite $1 "    ' เริ่มเซิร์ฟเวอร์แบบซ่อนหน้าต่าง (0 = Hidden)$\r$\n"
  FileWrite $1 "    objShell.CurrentDirectory = $\"$INSTDIR$\"$\r$\n"
  FileWrite $1 "    objShell.Run $\"node server.js$\", 0, False$\r$\n"
  FileWrite $1 "    WScript.Sleep 2500$\r$\n"
  FileWrite $1 "End If$\r$\n"
  FileWrite $1 "$\r$\n"
  FileWrite $1 "' เปิดเบราว์เซอร์$\r$\n"
  FileWrite $1 "objShell.Run $\"http://localhost:${PORT}$\", 1, False$\r$\n"
  FileClose $1

  ; สร้าง Stop Script
  FileOpen $1 "$INSTDIR\stop-p4p.vbs" w
  FileWrite $1 "Dim objShell$\r$\n"
  FileWrite $1 "Set objShell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $1 "objShell.Run $\"taskkill /f /im node.exe$\", 0, True$\r$\n"
  FileWrite $1 "MsgBox $\"หยุดโปรแกรม P4P Hospital เรียบร้อยแล้ว$\", 64, $\"P4P Hospital$\"$\r$\n"
  FileClose $1

  ; ----------------------------------------------------------
  ; สร้าง Desktop Shortcut และ Start Menu
  ; ----------------------------------------------------------
  DetailPrint "สร้าง Shortcuts..."
  SetOutPath "$INSTDIR"

  CreateDirectory "$SMPROGRAMS\P4P Hospital"
  CreateShortCut "$SMPROGRAMS\P4P Hospital\เปิด P4P Hospital.lnk" \
    "$SYSDIR\wscript.exe" '"$INSTDIR\start-p4p.vbs"'
  CreateShortCut "$SMPROGRAMS\P4P Hospital\หยุดเซิร์ฟเวอร์.lnk" \
    "$SYSDIR\wscript.exe" '"$INSTDIR\stop-p4p.vbs"'
  CreateShortCut "$SMPROGRAMS\P4P Hospital\ถอนการติดตั้ง.lnk" \
    "$INSTDIR\Uninstall.exe"
  CreateShortCut "$DESKTOP\P4P Hospital.lnk" \
    "$SYSDIR\wscript.exe" '"$INSTDIR\start-p4p.vbs"'

  ; ----------------------------------------------------------
  ; Registry (Add/Remove Programs)
  ; ----------------------------------------------------------
  WriteRegStr HKLM "${INSTKEY}" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr  HKLM "${UNINSTKEY}" "DisplayName"          "${APPNAME}"
  WriteRegStr  HKLM "${UNINSTKEY}" "UninstallString"      '"$INSTDIR\Uninstall.exe"'
  WriteRegStr  HKLM "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr  HKLM "${UNINSTKEY}" "Publisher"            "${PUBLISHER}"
  WriteRegStr  HKLM "${UNINSTKEY}" "DisplayVersion"       "${APPVERSION}"
  WriteRegStr  HKLM "${UNINSTKEY}" "InstallLocation"      "$INSTDIR"
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTKEY}" "NoRepair" 1

  DetailPrint "ติดตั้งเสร็จสมบูรณ์!"

SectionEnd

; ============================================================
; Uninstall Section
; ============================================================
Section "Uninstall"

  ; หยุด Node.js ก่อนลบไฟล์
  ExecWait 'taskkill /f /im node.exe'

  ; ลบไฟล์ทั้งหมด
  RMDir /r "$INSTDIR"

  ; ลบ Shortcuts
  Delete "$DESKTOP\P4P Hospital.lnk"
  RMDir /r "$SMPROGRAMS\P4P Hospital"

  ; ลบ Registry
  DeleteRegKey HKLM "${UNINSTKEY}"
  DeleteRegKey HKLM "${INSTKEY}"

SectionEnd
