Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CueTaskbar{[DllImport("user32.dll")]public static extern IntPtr FindWindow(string c,string n);}'
$taskbarHandle=[CueTaskbar]::FindWindow('Shell_TrayWnd',$null)
if($taskbarHandle -eq [IntPtr]::Zero){throw 'Windows taskbar unavailable to acceptance probe.'}
$root=[System.Windows.Automation.AutomationElement]::FromHandle($taskbarHandle)
$items=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$matches=New-Object 'System.Collections.Generic.List[object]'
foreach($item in $items){try{$aid=$item.Current.AutomationId;$name=$item.Current.Name;if($aid -like '*local.cueglass.tray-acceptance*'){$matches.Add([pscustomobject]@{match=$true})}}catch{}}
[pscustomobject]@{matchingCount=$matches.Count;taskbarAvailable=$true} | ConvertTo-Json -Compress
