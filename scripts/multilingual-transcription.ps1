param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$evidence=Join-Path $Root 'evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$cases=@(
 @{culture='zh-CN';language='zh';phrase='你如何解决复杂的问题？请解释你的方法并举一个例子。';keywords=@('问题','方法')},
 @{culture='ru-RU';language='ru';phrase='Как вы решаете сложные задачи? Объясните свой подход и приведите пример.';keywords=@('сложные','пример')}
)
$results=@()
foreach($case in $cases){
 $speech=New-Object System.Speech.Synthesis.SpeechSynthesizer
 try{
  $voice=@($speech.GetInstalledVoices() | Where-Object {$_.Enabled -and $_.VoiceInfo.Culture.Name -eq $case.culture}) | Select-Object -First 1
  if(!$voice){$results+=@{language=$case.language;skipped=$true;reason='No installed offline synthesis voice'};continue}
  $speech.SelectVoice($voice.VoiceInfo.Name)
  $fixture=Join-Path $evidence ('synthetic-'+$case.language+'.wav')
  $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
  $speech.SetOutputToWaveFile($fixture,$format)
  $speech.Speak($case.phrase)
 }finally{$speech.Dispose()}
 foreach($language in @($case.language,'auto')){
  $output=Join-Path $evidence ('offline-'+$case.language+'-'+$language)
  $timer=[Diagnostics.Stopwatch]::StartNew()
  & (Join-Path $Root 'bundled\whisper\whisper-cli.exe') -m (Join-Path $Root 'bundled\whisper\ggml-base-q5_1.bin') -f $fixture -otxt -of $output -nt -l $language -t 2 -ng *> (Join-Path $evidence ('whisper-'+$case.language+'-'+$language+'.log'))
  if($LASTEXITCODE -ne 0){throw 'Bundled multilingual transcription exited unsuccessfully'}
  $timer.Stop()
  $text=[IO.File]::ReadAllText($output+'.txt',[Text.Encoding]::UTF8).Trim()
  $comparison=$text.Replace('問題','问题') # Accept the traditional spelling in keyword checks only; never rewrite output.
  $recovered=@($case.keywords | Where-Object {$comparison.Contains($_)})
  $results+=@{language=$case.language;setting=$language;seconds=$timer.Elapsed.TotalSeconds;transcript=$text;nonempty=[bool]$text;expectedKeywords=$case.keywords;recoveredKeywords=$recovered;keywordsRecovered=($recovered.Count -eq $case.keywords.Count)}
  if(!$text){throw 'Bundled multilingual transcription returned no text'}
 }
}
@{fixture='Installed Windows offline speech synthesis to files; no microphone or playback';model='Multilingual base Q5_1';threads=2;cpuOnly=$true;results=$results;accuracyGuarantee=$false;keywordMatching='Chinese problem keyword accepts simplified/traditional spelling; output is unchanged'} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'multilingual-transcription.json') -Encoding UTF8
$results | ConvertTo-Json -Depth 6
