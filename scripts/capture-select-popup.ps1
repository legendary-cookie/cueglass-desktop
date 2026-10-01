param([Parameter(Mandatory=$true)][int]$AppProcessId,[Parameter(Mandatory=$true)][string]$OutputPath,[string]$AdditionalProcessIds='',[long]$MainWindowHandle=0)
$ErrorActionPreference='Stop'
# Acceptance-only capture: never capture a desktop or an unrelated window.
$testProcess=Get-Process -Id $AppProcessId
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Runtime.InteropServices;
public class CueSelectPopup {
 [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint rights,bool inherit,int id);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr h,uint flags,StringBuilder path,ref uint size);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
 public delegate bool Visitor(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool EnumWindows(Visitor v,IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder b,int n);
}
'@
$handle=[CueSelectPopup]::OpenProcess(0x1000,$false,$AppProcessId);$path=[Text.StringBuilder]::new(4096);[uint32]$size=4096
try{if($handle -eq [IntPtr]::Zero -or ![CueSelectPopup]::QueryFullProcessImageName($handle,0,$path,[ref]$size)){throw 'Cannot verify test process image; no capture.'}}finally{if($handle -ne [IntPtr]::Zero){[void][CueSelectPopup]::CloseHandle($handle)}}
if($testProcess.ProcessName -ne 'Cueglass' -or $path.ToString() -notlike '*\release\*\win-unpacked\Cueglass.exe'){throw "Expected an isolated packaged Cueglass test process; received $($testProcess.ProcessName) at $path."}
$allowed=@($AppProcessId)
if($AdditionalProcessIds){if($AdditionalProcessIds -notmatch '^\d+(,\d+)*$'){throw 'Invalid owned process list.'};foreach($id in $AdditionalProcessIds.Split(',')){
 $handle=[CueSelectPopup]::OpenProcess(0x1000,$false,[int]$id);$childPath=[Text.StringBuilder]::new(4096);[uint32]$size=4096
 try{if($handle -ne [IntPtr]::Zero -and [CueSelectPopup]::QueryFullProcessImageName($handle,0,$childPath,[ref]$size) -and $childPath.ToString() -eq $path.ToString()){$allowed+=[int]$id}}finally{if($handle -ne [IntPtr]::Zero){[void][CueSelectPopup]::CloseHandle($handle)}}
}}
$windows=[Collections.Generic.List[object]]::new()
[CueSelectPopup]::EnumWindows({param($h,$unused)
 [uint32]$ownerProcessId=0;[void][CueSelectPopup]::GetWindowThreadProcessId($h,[ref]$ownerProcessId)
 if($allowed -contains $ownerProcessId -and [CueSelectPopup]::IsWindowVisible($h)){
  $class=[Text.StringBuilder]::new(256);[void][CueSelectPopup]::GetClassName($h,$class,256)
  if($class.ToString() -like 'Chrome_WidgetWin_*' -and $h.ToInt64() -ne $MainWindowHandle){
   $rect=[CueSelectPopup+Rect]::new();[void][CueSelectPopup]::GetWindowRect($h,[ref]$rect)
   $windows.Add([pscustomobject]@{Handle=$h;Class=$class.ToString();Left=$rect.Left;Top=$rect.Top;Width=$rect.Right-$rect.Left;Height=$rect.Bottom-$rect.Top})
  }
 };return $true
},[IntPtr]::Zero) | Out-Null
$popup=@($windows | Where-Object {$_.Width -gt 20 -and $_.Width -lt 1200 -and $_.Height -gt 10 -and $_.Height -lt 1000})
if($popup.Count -ne 1){throw "Expected exactly one visible owned native popup; found $($popup.Count). No screenshot taken."}
$item=$popup[0];$image=[Drawing.Bitmap]::new($item.Width,$item.Height);$graphics=[Drawing.Graphics]::FromImage($image)
try{
 if(![CueSelectPopup]::IsWindowVisible($item.Handle)){throw 'Popup closed before capture.'}
 $dc=$graphics.GetHdc();try{if(![CueSelectPopup]::PrintWindow($item.Handle,$dc,2)){throw 'Owned popup rendering unavailable; no desktop capture fallback.'}}finally{$graphics.ReleaseHdc($dc)}
 if(![CueSelectPopup]::IsWindowVisible($item.Handle)){throw 'Popup closed during capture; no artifact saved.'}
 $image.Save([IO.Path]::GetFullPath($OutputPath),[Drawing.Imaging.ImageFormat]::Png)
}finally{$graphics.Dispose();$image.Dispose()}
[pscustomobject]@{kind='owned-native-select-popup';class=$item.Class;width=$item.Width;height=$item.Height;path=$OutputPath} | ConvertTo-Json -Compress
