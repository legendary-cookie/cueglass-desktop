param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$evidence=Join-Path $Root 'evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$fixture=Join-Path $evidence 'synthetic-speech.wav'
$speech=New-Object System.Speech.Synthesis.SpeechSynthesizer
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$speech.SetOutputToWaveFile($fixture,$format)
$speech.Speak('How would you solve a difficult problem with limited information? Explain your approach and give one example.')
$speech.Dispose()
$output=Join-Path $evidence 'offline-transcription'
$timer=[Diagnostics.Stopwatch]::StartNew()
& (Join-Path $Root 'bundled\whisper\whisper-cli.exe') -m (Join-Path $Root 'bundled\whisper\ggml-base-q5_1.bin') -f $fixture -otxt -of $output -nt -l en -t 2
if($LASTEXITCODE -ne 0){throw 'Bundled Whisper failed to transcribe synthetic speech'}
$timer.Stop()
$text=Get-Content -Raw -LiteralPath ($output+'.txt')
if($text -notmatch 'difficult problem' -or $text -notmatch 'information'){throw 'Synthetic speech recognition did not recover key phrases'}
@{fixture='Windows offline speech synthesis; no microphone';model='base multilingual Q5_1';threads=2;seconds=$timer.Elapsed.TotalSeconds;transcript=$text.Trim();passed=$true} | ConvertTo-Json | Set-Content (Join-Path $evidence 'offline-transcription.json') -Encoding UTF8
