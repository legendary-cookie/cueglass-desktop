# Cueglass for Windows

A configurable desktop overlay for interview practice and permitted meeting assistance. Local multilingual speech transcription, streamed provider answers, and an optional comparison of up to three selected models.

**[Download the Windows installer](https://github.com/legendary-cookie/cueglass-desktop/releases/latest)** · **[Getting started](docs/QUICKSTART.md)** · **[Whisper model guide](docs/MODELS.md)** · **[Troubleshooting](docs/TROUBLESHOOTING.md)**

The installer includes Fast, Balanced and Higher accuracy multilingual Whisper models. No separate Python, Ollama or model download is needed for these presets. Balanced is the default. Online AI answers require your own supported account or separately billed provider credentials; local transcription works without them.

## Before you install

- Windows x64; Windows 11 recommended. See [requirements and measured results](docs/REQUIREMENTS.md).
- Installer is **unsigned**. Verify its SHA-256 against the release checksum. SmartScreen may warn; do not disable Windows security. If your organization blocks unsigned apps, obtain its approval or wait for a signed release.
- Use only where assistance and recording are permitted. Obtain required participant consent. The overlay's capture exclusion cannot guarantee invisibility in every share mode.
- Recording and automatic replies are off at launch. The installer creates no startup task/service and never starts recording or signs you in.

## What you can do

Choose a microphone, system playback or supported application audio. Choose a speech language, correct transcripts, and choose an independent answer language. Enable automatic speech-pause answers deliberately, or use Answer now. Select a provider and model for each answer card; Auto prefers lower usage/latency among available choices. Each additional card makes an additional request.

Pin locks movement; Top controls always-on-top. Light/Dark/High contrast, custom colors, text size, compact mode and 0–90% background transparency are configurable. The tray provides Show/Hide, Settings, Pause and Quit. Global shortcuts are configurable, with collision feedback and recovery.

## Documentation

- [Install, upgrade, uninstall and first session](docs/QUICKSTART.md)
- [Providers, audio, languages, automation, vision and controls](docs/USER-GUIDE.md)
- [Three bundled models, sizes, expected trade-offs and hashes](docs/MODELS.md)
- [Requirements, measured validation and limitations](docs/REQUIREMENTS.md)
- [Local versus remote data and responsible use](docs/PRIVACY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Third-party notices and corresponding source links](docs/THIRD-PARTY.md)

This repository contains public distribution documentation and release assets. It does not publish application development history or private user/test data. See the release manifest for exact runtime/model versions and checksums. Report issues without tokens, email/account identifiers, recordings, meeting screenshots or personal documents.
