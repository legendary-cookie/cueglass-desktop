$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output=Join-Path $root 'bundled\native'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'Windows .NET Framework compiler is unavailable. Build the native helper on Windows with .NET Framework 4.x.'}
& $compiler /nologo /optimize+ /platform:x64 /target:exe /reference:System.Web.Extensions.dll ('/out:'+(Join-Path $output 'CueAudio.exe')) (Join-Path $root 'native\CueAudio.cs')
if($LASTEXITCODE -ne 0){throw 'Native audio bridge compilation failed'}
