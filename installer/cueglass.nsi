Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!ifndef VERSION
 !define VERSION "0.6.0"
!endif
!ifndef REGKEY
 !define REGKEY "CueglassDesktop"
!endif
!ifndef DISPLAYNAME
 !define DISPLAYNAME "Cueglass"
!endif
Name "${DISPLAYNAME} ${VERSION}"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\Cueglass"
RequestExecutionLevel user
SetCompressor zlib
SetOverwrite on
BrandingText "Cueglass | Per-user installation"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_OK "Cueglass requires Windows x64. No files were installed." /SD IDOK
  Abort
 ${EndIf}
 SetShellVarContext current
FunctionEnd
Section "Cueglass"
 ; Do not adopt a nonempty unrelated directory, or overwrite a running app.
 IfFileExists "$INSTDIR\cueglass-installed.marker" owned
 IfFileExists "$INSTDIR\*.*" 0 owned
 MessageBox MB_OK "This folder already contains unrelated files. Installation stopped without replacing them." /SD IDOK
 SetErrorLevel 2
 Abort
 owned:
 InitPluginsDir
 SetOutPath "$PLUGINSDIR"
 File "/oname=InstallGuard.exe" "${GUARD}"
 nsExec::ExecToStack '"$PLUGINSDIR\InstallGuard.exe" "$INSTDIR"'
 Pop $0
 Pop $1
 ${If} $0 != 0
  MessageBox MB_OK "Cueglass is running in this installation folder, or its state could not be verified. Save/export your session and Quit through the tray, then retry. No process was closed." /SD IDOK
  SetErrorLevel 2
  Abort
 ${EndIf}
 SetOutPath "$INSTDIR"
 File /r "${PAYLOAD}\*.*"
 FileOpen $0 "$INSTDIR\cueglass-installed.marker" w
 FileWrite $0 "Cueglass managed installation ${VERSION}"
 FileClose $0
 WriteUninstaller "$INSTDIR\Uninstall Cueglass.exe"
 ; Skip conflicting shortcuts instead of replacing unknown user files.
 IfFileExists "$DESKTOP\${DISPLAYNAME} (installed).lnk" desktop_done
 CreateShortcut "$DESKTOP\${DISPLAYNAME} (installed).lnk" "$INSTDIR\Cueglass.exe"
 desktop_done:
 CreateDirectory "$SMPROGRAMS\${DISPLAYNAME}"
 IfFileExists "$SMPROGRAMS\${DISPLAYNAME}\${DISPLAYNAME}.lnk" menu_done
 CreateShortcut "$SMPROGRAMS\${DISPLAYNAME}\${DISPLAYNAME}.lnk" "$INSTDIR\Cueglass.exe"
 menu_done:
 WriteRegStr HKCU "Software\${REGKEY}" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "DisplayName" "${DISPLAYNAME}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "DisplayVersion" "${VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "UninstallString" '$\"$INSTDIR\Uninstall Cueglass.exe$\"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}" "NoRepair" 1
 ; No auto-launch, recording, startup task, service or security-setting changes.
SectionEnd
Section "Uninstall"
 SetShellVarContext current
 IfFileExists "$INSTDIR\cueglass-installed.marker" 0 refuse
 InitPluginsDir
 SetOutPath "$PLUGINSDIR"
 File "/oname=InstallGuard.exe" "${GUARD}"
 nsExec::ExecToStack '"$PLUGINSDIR\InstallGuard.exe" "$INSTDIR"'
 Pop $0
 Pop $1
 ${If} $0 != 0
  MessageBox MB_OK "Save/export your session and Quit this installed Cueglass through the tray, then retry. Nothing was removed." /SD IDOK
  SetErrorLevel 2
  Abort
 ${EndIf}
 nsExec::ExecToStack '"$PLUGINSDIR\InstallGuard.exe" --shortcut-owned "$DESKTOP\${DISPLAYNAME} (installed).lnk" "$INSTDIR\Cueglass.exe"'
 Pop $0
 Pop $1
 ${If} $0 == 0
  Delete "$DESKTOP\${DISPLAYNAME} (installed).lnk"
 ${EndIf}
 nsExec::ExecToStack '"$PLUGINSDIR\InstallGuard.exe" --shortcut-owned "$SMPROGRAMS\${DISPLAYNAME}\${DISPLAYNAME}.lnk" "$INSTDIR\Cueglass.exe"'
 Pop $0
 Pop $1
 ${If} $0 == 0
  Delete "$SMPROGRAMS\${DISPLAYNAME}\${DISPLAYNAME}.lnk"
 ${EndIf}
 ; Resolve shortcut ownership while the target file still exists, then remove
 ; only known installed files. User data lives outside INSTDIR.
 !include "${DELETEFILES}"
 Delete "$INSTDIR\cueglass-installed.marker"
 Delete "$INSTDIR\Uninstall Cueglass.exe"
 RMDir "$INSTDIR"
 RMDir "$SMPROGRAMS\${DISPLAYNAME}"
 DeleteRegKey HKCU "Software\${REGKEY}"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${REGKEY}"
 Goto done
 refuse:
 MessageBox MB_OK "The installation marker is missing. Nothing was removed." /SD IDOK
 SetErrorLevel 2
 done:
SectionEnd
