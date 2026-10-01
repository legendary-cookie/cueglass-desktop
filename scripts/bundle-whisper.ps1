param([string]$Destination = (Join-Path $PSScriptRoot '..\bundled\whisper'))
$ErrorActionPreference='Stop'
$destinationPath=[IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
$downloads=Join-Path $destinationPath '_downloads'
New-Item -ItemType Directory -Force -Path $downloads | Out-Null
$runtimeUrl='https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip'
$runtimeHash='49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
$catalog=Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\src\speech-catalog.json') -Raw | ConvertFrom-Json
$models=@($catalog | Where-Object {$_.id -in @('tiny-q5_1','base-q5_1','small-q5_1')})
if($models.Count -ne 3){throw 'Three curated multilingual model entries are required.'}
function Get-Verified([string]$Url,[string]$Path,[string]$Hash) {
 if(!(Test-Path -LiteralPath $Path)){Invoke-WebRequest -Uri $Url -OutFile $Path}
 if((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash){throw 'Downloaded artifact checksum mismatch. File will not be executed or packaged.'}
}
$archive=Join-Path $downloads 'whisper-bin-x64.zip'
Get-Verified $runtimeUrl $archive $runtimeHash
$extracted=Join-Path $downloads 'runtime'
if(!(Test-Path $extracted)){Expand-Archive -LiteralPath $archive -DestinationPath $extracted}
$cli=Get-ChildItem -LiteralPath $extracted -Recurse -Filter whisper-cli.exe | Select-Object -First 1
if(!$cli){throw 'Official archive did not contain whisper-cli.exe'}
Copy-Item -LiteralPath $cli.FullName -Destination $destinationPath
Get-ChildItem -LiteralPath $cli.DirectoryName -Filter *.dll | Copy-Item -Destination $destinationPath
foreach($model in $models){
 if($model.file -notmatch '^ggml-(tiny|base|small)-q5_1\.bin$' -or $model.url -notmatch '^https://huggingface.co/ggerganov/whisper.cpp/resolve/[a-f0-9]{40}/'){throw 'Unexpected model source.'}
 $path=Join-Path $destinationPath $model.file
 Get-Verified $model.url $path $model.sha256
 if((Get-Item -LiteralPath $path).Length -ne $model.bytes){throw 'Model size mismatch.'}
}
Invoke-WebRequest 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.2/LICENSE' -OutFile (Join-Path $destinationPath 'LICENSE-whisper.cpp.txt')
Invoke-WebRequest 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE' -OutFile (Join-Path $destinationPath 'LICENSE-Whisper.txt')
Invoke-WebRequest 'https://raw.githubusercontent.com/libsdl-org/SDL/release-2.28.5/LICENSE.txt' -OutFile (Join-Path $destinationPath 'LICENSE-SDL2.txt')
@{runtimeVersion='1.9.2';runtimeSource=$runtimeUrl;runtimeArchiveSHA256=$runtimeHash;defaultModel='base-q5_1';models=$models;modelBytes=($models | Measure-Object -Property bytes -Sum).Sum;licenses=@('MIT','zlib');files=@(Get-ChildItem -LiteralPath $destinationPath -File | Where-Object {$_.Name -ne 'manifest.json'} | ForEach-Object {@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destinationPath 'manifest.json') -Encoding UTF8
Write-Output 'Verified official CPU runtime and three multilingual Q5_1 models are ready.'
