# Requirements, performance and verification

## Platform and practical recommendations

The release is Windows **x64** only. Windows 11 is recommended; Windows 10 supports fewer capture paths. A working .NET Framework 4.x runtime is needed by the supplied native helpers. Windows microphone permission, an available audio device/process and applicable organizational permission may be necessary. ARM64-native, Windows 7/8, macOS and Linux builds are not provided or validated.

Process-specific playback loopback requires Windows build **20348 or newer**; common Windows 10 desktop builds are below this threshold. Documented window capture exclusion requires build **19041 or newer**; older/unsupported capture modes can include the overlay or show black. Meeting recipient shares remain path-dependent and unverified. See [Microsoft process loopback](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/) and [window capture affinity](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity).

These are **practical recommendations, not measured minimum specifications**:

| Use | Starting recommendation |
| --- | --- |
| Fast / light practice | Modern x64 CPU with at least four logical cores, 8 GB system RAM, SSD storage |
| Meeting app + Balanced/Small | 16 GB RAM or more and spare CPU capacity while the meeting runs; SSD recommended |
| GPU | Not required. The supplied transcription path is CPU-only, two threads; GPU capability is not used automatically. |
| Disk | Allow roughly 3 GB free during install/upgrade for setup, installed files and temporary copies; this is a headroom estimate. Optional downloads/exports need additional space. Exact installer and installed-payload sizes are in the release manifest. |
| Network | Not needed for the three included Whisper presets or offline practice; needed for sign-in/catalog refresh/online answers/optional downloads. |

No low-end hardware certification or universal real-time guarantee is claimed. If transcription lags, use Fast, reduce competing workload, and pause/correct if chunks are dropped. Installation includes the CPU runtime and weights; Python, FFmpeg CLI, Ollama and another local model service are not required for these presets.

## Small synthetic measurement

An English Windows TTS phrase, about 6.79 seconds of 16 kHz mono 16-bit PCM, was transcribed locally in fresh whisper-cli processes. Text: “Can you describe a difficult problem you solved, explain your decision, and tell me what you learned?” This is artificial speech, not a meeting recording.

Host: AMD Ryzen 7 9700X (8 cores / 16 logical processors), approximately 32 GB RAM, Windows 11 build 26200. Runtime: whisper.cpp 1.9.2 CPU, **two threads, GPU disabled**, explicit English, each Q5_1 model. Single sequential run per preset; elapsed wall time includes process startup/model initialization. Model bytes had been read for hashing, so filesystem cache was warm. Ordinary host workload was not controlled; these numbers are illustrative, not a rigorous latency benchmark or a hardware minimum.

| Preset | Packaged-runtime wall time | Observed artificial phrase result |
| --- | ---: | --- |
| Fast / Tiny Q5_1 | 0.759 s | Intended words recovered; original punctuation retained |
| Balanced / Base Q5_1 | 1.118 s | Intended words recovered; split into sentences with different punctuation |
| Higher accuracy / Small Q5_1 | 3.848 s | Intended words recovered; original punctuation retained |

This easy English fixture does not establish a WER, accent/noise quality ranking, multilingual accuracy, code-switch performance or meeting end-to-end latency. GPU/PyTorch speed charts elsewhere are not equivalent. Local capture/chunking, speech-pause gating and online provider streaming add additional delay.

## Release checks and known gaps

Model sizes/hashes, offline availability, UI preset selection and offline restart persistence are verified with synthetic isolated profiles. Unit/type/lint, native build and packaged UI checks are run before publication. Installer lifecycle uses an isolated target/profile/registry namespace so the user's active installation and data are not uninstalled. See the release's validation summary for exact final checks and installer SHA-256.

Real Teams/Meet/Zoom recipient capture behavior, real audio-device quality, every Windows/device combination, live provider inference and complete OAuth inference flow are **not verified by these tests**. Smart Turn is not integrated; automatic replies use energy VAD/stable-text/question heuristics. The UI is English, despite multilingual speech/answer controls. Auto language and mixed speech remain fallible. The installer/app are unsigned and may trigger SmartScreen or organization policy. No OS security setting is changed or needs to be disabled.
